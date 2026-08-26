// Major US cities for local SEO blog angles (ophthalmology / vision correction).

const US_CITIES = [
  { name: 'Los Angeles', state: 'CA' },
  { name: 'Beverly Hills', state: 'CA' },
  { name: 'Westlake Village', state: 'CA' },
  { name: 'New York', state: 'NY' },
  { name: 'Chicago', state: 'IL' },
  { name: 'Houston', state: 'TX' },
  { name: 'Phoenix', state: 'AZ' },
  { name: 'Philadelphia', state: 'PA' },
  { name: 'San Antonio', state: 'TX' },
  { name: 'San Diego', state: 'CA' },
  { name: 'Dallas', state: 'TX' },
  { name: 'Austin', state: 'TX' },
  { name: 'San Jose', state: 'CA' },
  { name: 'Jacksonville', state: 'FL' },
  { name: 'San Francisco', state: 'CA' },
  { name: 'Seattle', state: 'WA' },
  { name: 'Denver', state: 'CO' },
  { name: 'Washington', state: 'DC' },
  { name: 'Boston', state: 'MA' },
  { name: 'Miami', state: 'FL' },
  { name: 'Atlanta', state: 'GA' },
  { name: 'Las Vegas', state: 'NV' },
  { name: 'Portland', state: 'OR' },
  { name: 'Nashville', state: 'TN' },
  { name: 'Minneapolis', state: 'MN' },
  { name: 'Tampa', state: 'FL' },
  { name: 'Orlando', state: 'FL' },
];

function cityLabel(city) {
  if (!city) return '';
  if (typeof city === 'string') return city.trim();
  return `${city.name}, ${city.state}`;
}

function resolveCity(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  const hit = US_CITIES.find(
    (c) => cityLabel(c).toLowerCase() === lower || c.name.toLowerCase() === lower
  );
  return hit ? cityLabel(hit) : raw;
}

function cityOptions() {
  return US_CITIES.map((c) => cityLabel(c));
}

module.exports = { US_CITIES, cityLabel, resolveCity, cityOptions };
