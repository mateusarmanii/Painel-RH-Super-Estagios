const uuidValido = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function pluralizar(total, singular, plural) {
  return `${total} ${total === 1 ? singular : plural}`;
}

module.exports = { uuidValido, pluralizar };
