const map = L.map('map', {
  zoomControl: true,
  minZoom: 5,
  maxZoom: 12,
}).setView([51.2, 10.45], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap-Mitwirkende',
}).addTo(map);

const events = [
  {
    city: 'Berlin',
    coords: [52.52, 13.405],
    title: 'Reggaeton Night Berlin',
    details: 'Freitag, 22:00 Uhr · Kreuzberg',
  },
  {
    city: 'Hamburg',
    coords: [53.5511, 9.9937],
    title: 'Salsa Social Hamburg',
    details: 'Samstag, 20:00 Uhr · St. Pauli',
  },
  {
    city: 'Köln',
    coords: [50.9375, 6.9603],
    title: 'Latin Street Food & Music',
    details: 'Sonntag, 14:00 Uhr · Innenstadt',
  },
  {
    city: 'Frankfurt',
    coords: [50.1109, 8.6821],
    title: 'Bachata Workshop',
    details: 'Mittwoch, 19:30 Uhr · Sachsenhausen',
  },
  {
    city: 'München',
    coords: [48.1351, 11.582],
    title: 'La Familia Meetup München',
    details: 'Donnerstag, 19:00 Uhr · Glockenbachviertel',
  },
  {
    city: 'Düsseldorf',
    coords: [51.2277, 6.7735],
    title: 'Latin Rooftop Party',
    details: 'Samstag, 21:00 Uhr · Medienhafen',
  },
];

const markerIcon = L.divIcon({
  className: 'latino-marker',
  html: '<span style="font-size: 1.4rem;">💃</span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

events.forEach((event) => {
  L.marker(event.coords, { icon: markerIcon })
    .addTo(map)
    .bindPopup(`<strong>${event.title}</strong><br>${event.city}<br>${event.details}`);
});
