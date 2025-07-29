const { google } = require('googleapis');
const path = require('path');

class SheetsService {
    constructor() {
        this.sheets = null;
        this.spreadsheetId = null;
        this.auth = null;
        
        // Simple rate limiting - increased to prevent hitting API limits
        this.lastRequestTime = 0;
        this.minRequestInterval = 2000; // Minimum 2 seconds between requests
        
        // Simple caching to reduce API calls
        this.cache = null;
        this.cacheExpiry = 0;
        this.cacheInterval = 30000; // Cache for 30 seconds
        
        // Save queue to prevent race conditions
        this.saveQueue = [];
        this.isSaving = false;
    }

    // Simple rate limiting helper
    async rateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.minRequestInterval) {
            const waitTime = this.minRequestInterval - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.lastRequestTime = Date.now();
    }

    async initialize(credentialsPath, spreadsheetId) {
        try {
            // Load credentials from the service account file
            const credentials = require(credentialsPath);
            
            this.auth = new google.auth.GoogleAuth({
                credentials: credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });

            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            this.spreadsheetId = spreadsheetId;
            
            // Initialize the sheet structure if needed
            await this.initializeSheetStructure();
            
            return true;
        } catch (error) {
            console.error('Failed to initialize Google Sheets:', error);
            return false;
        }
    }

    async initializeSheetStructure() {
        try {
            await this.rateLimit();
            
            // Check if sheet exists and has the right structure
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });

            // Create headers if sheet is empty
            const headers = [
                'ID', 'Created Date', 'Address', 'Contact Name', 'Contact Email',
                // Milestone columns (30 milestones * 4 columns each = 120 columns)
                // Each milestone has: Completed, Date, Tags (JSON), Notes (JSON)
                'Keys Completed', 'Keys Date', 'Keys Tags', 'Keys Notes',
                'Power Completed', 'Power Date', 'Power Tags', 'Power Notes',
                'Water Completed', 'Water Date', 'Water Tags', 'Water Notes',
                'Deposit held Completed', 'Deposit held Date', 'Deposit held Tags', 'Deposit held Notes',
                'Balance Completed', 'Balance Date', 'Balance Tags', 'Balance Notes',
                'Move-out Completed', 'Move-out Date', 'Move-out Tags', 'Move-out Notes',
                'Quote Completed', 'Quote Date', 'Quote Tags', 'Quote Notes',
                'Contact owner Completed', 'Contact owner Date', 'Contact owner Tags', 'Contact owner Notes',
                'Email inspection video + quote Completed', 'Email inspection video + quote Date', 'Email inspection video + quote Tags', 'Email inspection video + quote Notes',
                'Follow up date Completed', 'Follow up date Date', 'Follow up date Tags', 'Follow up date Notes',
                'Approval Completed', 'Approval Date', 'Approval Tags', 'Approval Notes',
                'Funds Completed', 'Funds Date', 'Funds Tags', 'Funds Notes',
                'Order of materials Completed', 'Order of materials Date', 'Order of materials Tags', 'Order of materials Notes',
                'Prebill Completed', 'Prebill Date', 'Prebill Tags', 'Prebill Notes',
                'Wait list Completed', 'Wait list Date', 'Wait list Tags', 'Wait list Notes',
                'Rehab start Completed', 'Rehab start Date', 'Rehab start Tags', 'Rehab start Notes',
                'Add ons Completed', 'Add ons Date', 'Add ons Tags', 'Add ons Notes',
                'Rehab ends Completed', 'Rehab ends Date', 'Rehab ends Tags', 'Rehab ends Notes',
                'Dump and pick up material left on site Completed', 'Dump and pick up material left on site Date', 'Dump and pick up material left on site Tags', 'Dump and pick up material left on site Notes',
                'Vendor? Completed', 'Vendor? Date', 'Vendor? Tags', 'Vendor? Notes',
                'Cleaning Completed', 'Cleaning Date', 'Cleaning Tags', 'Cleaning Notes',
                'Quality control -final walkthrough Completed', 'Quality control -final walkthrough Date', 'Quality control -final walkthrough Tags', 'Quality control -final walkthrough Notes',
                'Final inspection Completed', 'Final inspection Date', 'Final inspection Tags', 'Final inspection Notes',
                'Open recurring task lawn care Completed', 'Open recurring task lawn care Date', 'Open recurring task lawn care Tags', 'Open recurring task lawn care Notes',
                'Move in inspection Completed', 'Move in inspection Date', 'Move in inspection Tags', 'Move in inspection Notes',
                'Assign all rehab tasks to bill Completed', 'Assign all rehab tasks to bill Date', 'Assign all rehab tasks to bill Tags', 'Assign all rehab tasks to bill Notes',
                'Video upload Completed', 'Video upload Date', 'Video upload Tags', 'Video upload Notes',
                'Turn off utilities Completed', 'Turn off utilities Date', 'Turn off utilities Tags', 'Turn off utilities Notes',
                'List property Completed', 'List property Date', 'List property Tags', 'List property Notes',
                'Billing finalized Completed', 'Billing finalized Date', 'Billing finalized Tags', 'Billing finalized Notes'
            ];

            // Check if first row exists and has headers
            const headerCheck = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'A1:E1'
            });

            if (!headerCheck.data.values || headerCheck.data.values.length === 0) {
                // Initialize headers
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: 'A1:EX1',
                    valueInputOption: 'RAW',
                    resource: {
                        values: [headers]
                    }
                });
                console.log('Sheet headers initialized');
            }
        } catch (error) {
            console.error('Error initializing sheet structure:', error);
        }
    }

    async getCompanies() {
        try {
            // Check cache first
            const now = Date.now();
            if (this.cache && now < this.cacheExpiry) {
                console.log('Returning cached data');
                return this.cache;
            }
            
            await this.rateLimit();
            
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'A2:EX1000' // Skip header row, get data rows (now includes tags and notes columns)
            });

            const rows = response.data.values || [];
            const companies = [];

            rows.forEach(row => {
                if (row.length > 0 && row[0]) { // Skip empty rows
                    const company = {
                        id: parseInt(row[0]) || 0,
                        createdDate: row[1] || '',
                        address: row[2] || '',
                        contactName: row[3] || '',
                        contactEmail: row[4] || '',
                        milestones: this.parseMilestonesFromRow(row)
                    };
                    companies.push(company);
                }
            });

            // Update cache
            this.cache = companies;
            this.cacheExpiry = now + this.cacheInterval;
            console.log('Data cached for', this.cacheInterval / 1000, 'seconds');

            return companies;
        } catch (error) {
            console.error('Error fetching companies from sheet:', error);
            return [];
        }
    }

    parseMilestonesFromRow(row) {
        const milestoneNames = [
            'Keys', 'Power', 'Water', 'Deposit held', 'Balance', 'Move-out',
            'Quote', 'Contact owner', 'Email inspection video + quote', 'Follow up date',
            'Approval', 'Funds', 'Order of materials', 'Prebill', 'Wait list',
            'Rehab start', 'Add ons', 'Rehab ends', 'Dump and pick up material left on site',
            'Vendor?', 'Cleaning', 'Quality control -final walkthrough', 'Final inspection',
            'Open recurring task lawn care', 'Move in inspection', 'Assign all rehab tasks to bill',
            'Video upload', 'Turn off utilities', 'List property', 'Billing finalized'
        ];

        const milestones = [];
        let colIndex = 5; // Start after the basic company info columns

        milestoneNames.forEach((name, index) => {
            const completed = row[colIndex] === 'TRUE' || row[colIndex] === true;
            const completedDate = row[colIndex + 1] || '';
            const tagsJson = row[colIndex + 2] || '[]';
            const notesJson = row[colIndex + 3] || '[]';

            let tags = [];
            let notes = [];
            
            try {
                tags = JSON.parse(tagsJson);
            } catch (e) {
                tags = [];
            }
            
            try {
                notes = JSON.parse(notesJson);
            } catch (e) {
                notes = [];
            }

            milestones.push({
                id: index + 1, // Add sequential ID starting from 1
                name,
                completed,
                completedDate,
                tags,
                notes
            });

            colIndex += 4; // Move to next milestone (completed + date + tags + notes columns)
        });

        return milestones;
    }

    async saveCompanies(companies) {
        return new Promise((resolve, reject) => {
            // Add to queue
            this.saveQueue.push({ companies, resolve, reject });
            
            // Process queue if not already processing
            if (!this.isSaving) {
                this.processSaveQueue();
            }
        });
    }

    async processSaveQueue() {
        if (this.isSaving || this.saveQueue.length === 0) {
            return;
        }

        this.isSaving = true;
        console.log('Processing save queue, items:', this.saveQueue.length);

        while (this.saveQueue.length > 0) {
            // Get the most recent save request (discard older ones)
            const latestSave = this.saveQueue.pop();
            // Clear the queue since we're taking the latest
            const allResolvers = this.saveQueue.map(item => item.resolve);
            const allRejecters = this.saveQueue.map(item => item.reject);
            this.saveQueue = [];

            try {
                const result = await this.actuallySave(latestSave.companies);
                
                // Resolve all pending promises with the same result
                latestSave.resolve(result);
                allResolvers.forEach(resolve => resolve(result));
                
                console.log('Save queue processed successfully');
            } catch (error) {
                // Reject all pending promises with the same error
                latestSave.reject(error);
                allRejecters.forEach(reject => reject(error));
                
                console.error('Save queue processing failed:', error);
            }
        }

        this.isSaving = false;
    }

    async actuallySave(companies) {
        try {
            await this.rateLimit();
            
            // Clear existing data (except headers)
            await this.sheets.spreadsheets.values.clear({
                spreadsheetId: this.spreadsheetId,
                range: 'A2:EX1000'
            });

            if (companies.length === 0) {
                // Clear cache since data changed
                this.cache = null;
                this.cacheExpiry = 0;
                return true;
            }

            // Convert companies to rows
            const rows = companies.map(company => this.companyToRow(company));

            // Update the sheet with new data
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `A2:EX${rows.length + 1}`,
                valueInputOption: 'RAW',
                resource: {
                    values: rows
                }
            });

            // Clear cache since data changed
            this.cache = null;
            this.cacheExpiry = 0;
            console.log('Cache cleared after save');

            return true;
        } catch (error) {
            console.error('Error saving companies to sheet:', error);
            return false;
        }
    }

    companyToRow(company) {
        const row = [
            company.id || '',
            company.createdDate || '',
            company.address || '',
            company.contactName || '',
            company.contactEmail || ''
        ];

        // Add milestone data (30 milestones * 4 columns each)
        const milestoneNames = [
            'Keys', 'Power', 'Water', 'Deposit held', 'Balance', 'Move-out',
            'Quote', 'Contact owner', 'Email inspection video + quote', 'Follow up date',
            'Approval', 'Funds', 'Order of materials', 'Prebill', 'Wait list',
            'Rehab start', 'Add ons', 'Rehab ends', 'Dump and pick up material left on site',
            'Vendor?', 'Cleaning', 'Quality control -final walkthrough', 'Final inspection',
            'Open recurring task lawn care', 'Move in inspection', 'Assign all rehab tasks to bill',
            'Video upload', 'Turn off utilities', 'List property', 'Billing finalized'
        ];

        milestoneNames.forEach(milestoneName => {
            const milestone = company.milestones?.find(m => m.name === milestoneName);
            if (milestone) {
                row.push(milestone.completed || false);
                row.push(milestone.completedDate || '');
                row.push(JSON.stringify(milestone.tags || []));
                row.push(JSON.stringify(milestone.notes || []));
            } else {
                row.push(false);
                row.push('');
                row.push('[]');
                row.push('[]');
            }
        });

        return row;
    }

    async addCompany(company) {
        try {
            await this.rateLimit();
            
            const companies = await this.getCompanies();
            
            // Generate new ID
            const maxId = companies.length > 0 ? Math.max(...companies.map(c => c.id || 0)) : 0;
            company.id = maxId + 1;
            
            companies.push(company);
            
            return await this.saveCompanies(companies);
        } catch (error) {
            console.error('Error adding company:', error);
            return false;
        }
    }

    async updateCompany(updatedCompany) {
        try {
            await this.rateLimit();
            
            const companies = await this.getCompanies();
            const index = companies.findIndex(c => c.id === updatedCompany.id);
            
            if (index !== -1) {
                companies[index] = updatedCompany;
                return await this.saveCompanies(companies);
            }
            
            return false;
        } catch (error) {
            console.error('Error updating company:', error);
            return false;
        }
    }

    async deleteCompany(companyId) {
        try {
            await this.rateLimit();
            
            const companies = await this.getCompanies();
            const filteredCompanies = companies.filter(c => c.id !== companyId);
            
            if (filteredCompanies.length !== companies.length) {
                return await this.saveCompanies(filteredCompanies);
            }
            
            return false;
        } catch (error) {
            console.error('Error deleting company:', error);
            return false;
        }
    }

    async clearAllData() {
        try {
            await this.rateLimit();
            
            // Clear all data (including headers) to start fresh
            await this.sheets.spreadsheets.values.clear({
                spreadsheetId: this.spreadsheetId,
                range: 'A:Z' // Clear all columns
            });
            
            console.log('All data cleared from spreadsheet');
            return true;
        } catch (error) {
            console.error('Error clearing spreadsheet data:', error);
            return false;
        }
    }

    async forceRefresh() {
        return await this.getCompanies();
    }
}

module.exports = SheetsService;
