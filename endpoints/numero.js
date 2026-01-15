/**
 * Endpoint NUMBER - MutanoX Premium
 * Consulta por número de telefone
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

function parseTelefoneData(text) {
  if (!isValidString(text)) return [];

  const results = [];
  const personBlocks = text.split('👤 PESSOA');
  for (let i = 1; i < personBlocks.length; i++) {
    const person = {};
    const cpfCnpjMatch = personBlocks[i].match(/• CPF\/CNPJ: (.+)/);
    if (cpfCnpjMatch) person.cpfCnpj = cpfCnpjMatch[1].trim();

    const nameMatch = personBlocks[i].match(/• Nome: (.+)/);
    if (nameMatch) person.name = nameMatch[1].trim();

    const birthDateMatch = personBlocks[i].match(/• Data de Nascimento: (.+)/);
    if (birthDateMatch) person.birthDate = birthDateMatch[1].trim();

    const neighborhoodMatch = personBlocks[i].match(/• Bairro: (.+)/);
    if (neighborhoodMatch) person.neighborhood = neighborhoodMatch[1].trim();

    const cityUfMatch = personBlocks[i].match(/• Cidade\/UF: (.+)/);
    if (cityUfMatch) person.cityUF = cityUfMatch[1].trim();

    const cepMatch = personBlocks[i].match(/• CEP: (\d+)/);
    if (cepMatch) person.cep = cepMatch[1];

    results.push(person);
  }
  return results;
}

async function consultarNumero(numero) {
  if (!isValidString(numero)) {
    return {
      success: false,
      error: 'Invalid or empty number',
      creator: '@MutanoX'
    };
  }

  try {
    const apiUrl = createApiUrl('https://world-ecletix.onrender.com/api/numero', { q: numero });
    if (!apiUrl) throw new Error('Invalid URL');

    console.log('[consultarNumero] Querying number:', numero);
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

    const parsedData = parseTelefoneData(data.resultado);
    return {
      success: true,
      totalResults: parsedData.length,
      results: parsedData,
      creator: '@MutanoX'
    };
  } catch (error) {
    console.error('[consultarNumero] Error:', error.message);
    return {
      success: false,
      error: error.message,
      creator: '@MutanoX'
    };
  }
}

module.exports = { consultarNumero, parseTelefoneData };
