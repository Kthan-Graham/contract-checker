// This will be used in the renderer process
async function initDB() {
  if (!window.electronAPI) {
    console.error('Electron API not available');
    return;
  }

  const companies = await window.electronAPI.getCompanies();
  if (!companies || companies.length === 0) {
    await window.electronAPI.saveCompanies([]);
  }
}

async function loadCompanies() {
  return await window.electronAPI.getCompanies();
}

async function saveCompanies(companies) {
  await window.electronAPI.saveCompanies(companies);
}

// Add this to your renderer process
async function addCompany(newCompany) {
  const companies = await loadCompanies();
  companies.push(newCompany);
  await saveCompanies(companies);
}

export { initDB, loadCompanies, saveCompanies, addCompany };