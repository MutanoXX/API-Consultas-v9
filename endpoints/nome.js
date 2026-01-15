/**
 * Endpoint NAME - MutanoX Premium
 * Consulta por nome completo
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
    console.error('[createApiUrl] Error creating URL:', error.message);
    return null;
  }
}

function parseNomeData(text) {
  if (!isValidString(text)) return [];

  const results = [];
  const personBlocks = text.split('👤 RESULTADO');
  for (let i = 1; i < personBlocks.length; i++) {
    const person = {};
    const cpfMatch = personBlocks[i].match(/• CPF: (\d+)/);
    if (cpfMatch) person.cpf = cpfMatch[1];

    const nameMatch = personBlocks[i].match(/• Nome: (.+)/);
    if (nameMatch) person.name = nameMatch[1].trim();

    const birthDateMatch = personBlocks[i].match(/• Data de Nascimento: (.+)/);
    if (birthDateMatch) person.birthDate = birthDateMatch[1].trim();

    const motherNameMatch = personBlocks[i].match(/• Nome da Mãe: (.+)/);
    if (motherNameMatch) person.motherName = motherNameMatch[1].trim();

    const registrationStatusMatch = personBlocks[i].match(/• Situação Cadastral: (.+)/);
    if (registrationStatusMatch) person.registrationStatus = registrationStatusMatch[1].trim();

    const streetMatch = personBlocks[i].match(/• Logradouro: (.+)/);
    if (streetMatch) person.street = streetMatch[1].trim();

    const neighborhoodMatch = personBlocks[i].match(/• Bairro: (.+)/);
    if (neighborhoodMatch) person.neighborhood = neighborhoodMatch[1].trim();

    const cepMatch = personBlocks[i].match(/• CEP: (\d+)/);
    if (cepMatch) person.cep = cepMatch[1];

    results.push(person);
  }
  return results;
}

async function consultarNome(nome) {
  if (!isValidString(nome)) {
    return {
      success: false,
      error: 'Invalid or empty name',
      creator: '@MutanoX'
    };
  }

  try {
    const apiUrl = createApiUrl('https://world-ecletix.onrender.com/api/nome-completo', { q: nome });
    if (!apiUrl) throw new Error('Invalid URL');

    console.log('[consultarNome] Querying name:', nome);
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

    const parsedData = parseNomeData(data.resultado);
    return {
      success: true,
      totalResults: parsedData.length,
      results: parsedData,
      creator: '@MutanoX'
    };
  } catch (error) {
    console.error('[consultarNome] Error:', error.message);
    return {
      success: false,
      error: error.message,
      creator: '@MutanoX'
    };
  }
}

module.exports = { consultarNome, parseNomeData };
