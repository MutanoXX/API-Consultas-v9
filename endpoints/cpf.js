/**
 * Endpoint CPF - MutanoX Premium
 * Consulta de CPF com parser de dados
 */

const { URL } = require('url');

function isValidString(str) {
  return typeof str === 'string' && str.trim().length > 0;
}

function createApiUrl(baseUrl, params) {
  try {
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    }
    return url.toString();
  } catch (error) {
    console.error('[createApiUrl] Erro ao criar URL:', error.message);
    return null;
  }
}

function parseCPFData(text) {
  if (!isValidString(text)) {
    return { error: 'Invalid response from API', receivedText: text };
  }

  const data = {
    basicData: {},
    economicData: {},
    addresses: [],
    voterCard: {},
    fiscalData: {},
    socialBenefits: [],
    politicallyExposedPerson: {},
    publicServant: {},
    consumptionProfile: {},
    vaccines: [],
    importantInfo: {}
  };

  const nameMatch = text.match(/• Nome: (.+)/);
  if (nameMatch) data.basicData.name = nameMatch[1].trim();

  const cpfMatch = text.match(/• CPF: (\d+)/);
  if (cpfMatch) data.basicData.cpf = cpfMatch[1];

  const cnsMatch = text.match(/• CNS: (\d+)/);
  if (cnsMatch) data.basicData.cns = cnsMatch[1];

  const birthDateMatch = text.match(/• Data de Nascimento: (.+)/);
  if (birthDateMatch) data.basicData.birthDate = birthDateMatch[1].trim();

  const sexMatch = text.match(/• Sexo: (.+)/);
  if (sexMatch) data.basicData.sex = sexMatch[1].trim();

  const motherNameMatch = text.match(/• Nome da Mãe: (.+)/);
  if (motherNameMatch) data.basicData.motherName = motherNameMatch[1].trim();

  const fatherNameMatch = text.match(/• Nome do Pai: (.+)/);
  if (fatherNameMatch) data.basicData.fatherName = fatherNameMatch[1].trim();

  const registrationStatusMatch = text.match(/• Situação Cadastral: (.+)/);
  if (registrationStatusMatch) data.basicData.registrationStatus = registrationStatusMatch[1].trim();

  const statusDateMatch = text.match(/• Data da Situação: (.+)/);
  if (statusDateMatch) data.basicData.statusDate = statusDateMatch[1].trim();

  const incomeMatch = text.match(/• Renda: (.+)/);
  if (incomeMatch) data.economicData.income = incomeMatch[1].trim();

  const purchasingPowerMatch = text.match(/• Poder Aquisitivo: (.+)/);
  if (purchasingPowerMatch) data.economicData.purchasingPower = purchasingPowerMatch[1].trim();

  const incomeRangeMatch = text.match(/• Faixa de Renda: (.+)/);
  if (incomeRangeMatch) data.economicData.incomeRange = incomeRangeMatch[1].trim();

  const scoreMatch = text.match(/• Score CSBA: (.+)/);
  if (scoreMatch) data.economicData.scoreCSBA = scoreMatch[1].trim();

  const addressBlocks = text.split('🏠 ENDEREÇO');
  for (let i = 1; i < addressBlocks.length; i++) {
    const address = {};
    const streetMatch = addressBlocks[i].match(/• Logradouro:\s*(.+)/);
    if (streetMatch) address.street = streetMatch[1].trim();

    const neighborhoodMatch = addressBlocks[i].match(/• Bairro:\s*(.+)/);
    if (neighborhoodMatch) address.neighborhood = neighborhoodMatch[1].trim();

    const cityMatch = addressBlocks[i].match(/• Cidade\/UF:\s*(.+)/);
    if (cityMatch) address.cityUF = cityMatch[1].trim();

    const cepMatch = addressBlocks[i].match(/• CEP:\s*(.+)/);
    if (cepMatch) address.cep = cepMatch[1].trim();

    if (Object.keys(address).length > 0) {
      data.addresses.push(address);
    }
  }

  const cpfValidMatch = text.match(/• CPF Válido: (.+)/);
  if (cpfValidMatch) data.importantInfo.cpfValid = cpfValidMatch[1].trim();

  const deathInfoMatch = text.match(/• Óbito: (.+)/);
  if (deathInfoMatch) data.importantInfo.death = deathInfoMatch[1].trim();

  const pepInfoMatch = text.match(/• PEP: (.+)/);
  if (pepInfoMatch) data.importantInfo.pep = pepInfoMatch[1].trim();

  return data;
}

async function consultarCPF(cpf) {
  if (!isValidString(cpf)) {
    return {
      success: false,
      error: 'Invalid or empty CPF',
      creator: '@MutanoX'
    };
  }

  try {
    const apiUrl = createApiUrl('https://world-ecletix.onrender.com/api/consultarcpf', { cpf });
    if (!apiUrl) throw new Error('Invalid URL');

    console.log('[consultarCPF] Querying CPF:', cpf);
    const response = await fetch(apiUrl);

    if (!response.ok) throw new Error(`API returned status ${response.status}`);

    const data = await response.json();
    if (!data || !data.resultado) {
      return {
        success: false,
        error: 'Invalid API response',
        response: data,
        creator: '@MutanoX'
      };
    }

    const parsedData = parseCPFData(data.resultado);
    return {
      success: true,
      data: parsedData,
      creator: '@MutanoX'
    };
  } catch (error) {
    console.error('[consultarCPF] Error:', error.message);
    return {
      success: false,
      error: error.message,
      creator: '@MutanoX'
    };
  }
}

module.exports = { consultarCPF, parseCPFData };
