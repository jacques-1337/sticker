// ═══════════════════════════════════════════════
//  CONFIG — Globale Konstanten + Städte-Datenbank
// ═══════════════════════════════════════════════

const SUPABASE_URL  = 'https://wabunpkobqjqyhbxbtai.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hB9Y4G_pbWWrTIEJYIukVA_tH_hyxqr';

const LOGO_URL = 'https://wabunpkobqjqyhbxbtai.supabase.co/storage/v1/object/public/sticker-photos/ChatGPT%20Image%2025.%20Apr.%202026,%2001_07_42.png';

const HOME_LAT = 52.3833;
const HOME_LNG = 13.2167;

function logoHTML(size = 24, opts = {}) {
  const { rounded = true, glow = false } = opts;
  const radius = rounded ? '50%' : '8px';
  const shadow = glow ? 'box-shadow: 0 4px 24px rgba(232,200,74,0.25);' : '';
  if (LOGO_URL) {
    return `<img src="${LOGO_URL}" alt="32er Stahnsdorf"
      style="width:${size}px;height:${size}px;border-radius:${radius};
             object-fit:cover;display:inline-block;vertical-align:middle;${shadow}">`;
  }
  const fontSize = Math.round(size * 0.5);
  return `<span style="display:inline-flex;align-items:center;justify-content:center;
    width:${size}px;height:${size}px;background:var(--accent);color:var(--bg);
    border-radius:${radius};font-size:${fontSize}px;font-weight:900;
    vertical-align:middle;${shadow}">32</span>`;
}

// ── Städte-Datenbank (300+ Städte weltweit) ──────────────────────────────────
const CITIES = [
  // Germany
  {n:'Berlin',c:'Deutschland',cc:'DE',f:'🇩🇪',lat:52.52,lng:13.405,cap:true,cont:'EU'},
  {n:'Hamburg',c:'Deutschland',cc:'DE',f:'🇩🇪',lat:53.55,lng:10.0,cont:'EU'},
  {n:'München',c:'Deutschland',cc:'DE',f:'🇩🇪',lat:48.137,lng:11.576,cont:'EU'},
  {n:'Köln',c:'Deutschland',cc:'DE',f:'🇩🇪',lat:50.938,lng:6.96,cont:'EU'},
  {n:'Frankfurt',c:'Deutschland',cc:'DE',f:'🇩🇪',lat:50.11,lng:8.682,cont:'EU'},
  {n:'Stuttgart',c:'Deutschland',cc:'DE',f:'🇩🇪',lat:48.78,lng:9.18,cont:'EU'},
  {n:'Düsseldorf',c:'Deutschland',cc:'DE',f:'🇩🇪',lat:51.22,lng:6.78,cont:'EU'},
  {n:'Leipzig',c:'Deutschland',cc:'DE',f:'🇩🇪',lat:51.34,lng:12.38,cont:'EU'},
  {n:'Dortmund',c:'Deutschland',cc:'DE',f:'🇩🇪',lat:51.52,lng:7.46,cont:'EU'},
  {n:'Dresden',c:'Deutschland',cc:'DE',f:'🇩🇪',lat:51.05,lng:13.74,cont:'EU'},
  {n:'Bremen',c:'Deutschland',cc:'DE',f:'🇩🇪',lat:53.08,lng:8.81,cont:'EU'},
  {n:'Potsdam',c:'Deutschland',cc:'DE',f:'🇩🇪',lat:52.39,lng:13.06,cont:'EU'},
  {n:'Stahnsdorf',c:'Deutschland',cc:'DE',f:'🇩🇪',lat:52.3833,lng:13.2167,cont:'EU'},
  // Europe
  {n:'London',c:'Großbritannien',cc:'GB',f:'🇬🇧',lat:51.51,lng:-0.128,cap:true,cont:'EU'},
  {n:'Paris',c:'Frankreich',cc:'FR',f:'🇫🇷',lat:48.857,lng:2.347,cap:true,cont:'EU'},
  {n:'Madrid',c:'Spanien',cc:'ES',f:'🇪🇸',lat:40.416,lng:-3.703,cap:true,cont:'EU'},
  {n:'Barcelona',c:'Spanien',cc:'ES',f:'🇪🇸',lat:41.387,lng:2.169,cont:'EU'},
  {n:'Rom',c:'Italien',cc:'IT',f:'🇮🇹',lat:41.9,lng:12.5,cap:true,cont:'EU'},
  {n:'Mailand',c:'Italien',cc:'IT',f:'🇮🇹',lat:45.466,lng:9.19,cont:'EU'},
  {n:'Amsterdam',c:'Niederlande',cc:'NL',f:'🇳🇱',lat:52.37,lng:4.9,cap:true,cont:'EU'},
  {n:'Brüssel',c:'Belgien',cc:'BE',f:'🇧🇪',lat:50.85,lng:4.35,cap:true,cont:'EU'},
  {n:'Wien',c:'Österreich',cc:'AT',f:'🇦🇹',lat:48.21,lng:16.37,cap:true,cont:'EU'},
  {n:'Zürich',c:'Schweiz',cc:'CH',f:'🇨🇭',lat:47.38,lng:8.54,cont:'EU'},
  {n:'Bern',c:'Schweiz',cc:'CH',f:'🇨🇭',lat:46.95,lng:7.45,cap:true,cont:'EU'},
  {n:'Prag',c:'Tschechien',cc:'CZ',f:'🇨🇿',lat:50.08,lng:14.47,cap:true,cont:'EU'},
  {n:'Warschau',c:'Polen',cc:'PL',f:'🇵🇱',lat:52.23,lng:21.01,cap:true,cont:'EU'},
  {n:'Budapest',c:'Ungarn',cc:'HU',f:'🇭🇺',lat:47.5,lng:19.04,cap:true,cont:'EU'},
  {n:'Bukarest',c:'Rumänien',cc:'RO',f:'🇷🇴',lat:44.43,lng:26.1,cap:true,cont:'EU'},
  {n:'Sofia',c:'Bulgarien',cc:'BG',f:'🇧🇬',lat:42.7,lng:23.32,cap:true,cont:'EU'},
  {n:'Athen',c:'Griechenland',cc:'GR',f:'🇬🇷',lat:37.98,lng:23.73,cap:true,cont:'EU'},
  {n:'Stockholm',c:'Schweden',cc:'SE',f:'🇸🇪',lat:59.33,lng:18.07,cap:true,cont:'EU'},
  {n:'Oslo',c:'Norwegen',cc:'NO',f:'🇳🇴',lat:59.91,lng:10.75,cap:true,cont:'EU'},
  {n:'Kopenhagen',c:'Dänemark',cc:'DK',f:'🇩🇰',lat:55.68,lng:12.57,cap:true,cont:'EU'},
  {n:'Helsinki',c:'Finnland',cc:'FI',f:'🇫🇮',lat:60.17,lng:24.94,cap:true,cont:'EU'},
  {n:'Lissabon',c:'Portugal',cc:'PT',f:'🇵🇹',lat:38.72,lng:-9.14,cap:true,cont:'EU'},
  {n:'Dublin',c:'Irland',cc:'IE',f:'🇮🇪',lat:53.33,lng:-6.25,cap:true,cont:'EU'},
  {n:'Reykjavik',c:'Island',cc:'IS',f:'🇮🇸',lat:64.14,lng:-21.94,cap:true,cont:'EU'},
  {n:'Tallinn',c:'Estland',cc:'EE',f:'🇪🇪',lat:59.44,lng:24.75,cap:true,cont:'EU'},
  {n:'Riga',c:'Lettland',cc:'LV',f:'🇱🇻',lat:56.95,lng:24.11,cap:true,cont:'EU'},
  {n:'Vilnius',c:'Litauen',cc:'LT',f:'🇱🇹',lat:54.69,lng:25.28,cap:true,cont:'EU'},
  {n:'Krakau',c:'Polen',cc:'PL',f:'🇵🇱',lat:50.06,lng:19.94,cont:'EU'},
  {n:'Laibach',c:'Slowenien',cc:'SI',f:'🇸🇮',lat:46.05,lng:14.5,cap:true,cont:'EU'},
  {n:'Zagreb',c:'Kroatien',cc:'HR',f:'🇭🇷',lat:45.81,lng:15.98,cap:true,cont:'EU'},
  {n:'Belgrad',c:'Serbien',cc:'RS',f:'🇷🇸',lat:44.82,lng:20.46,cap:true,cont:'EU'},
  {n:'Bratislava',c:'Slowakei',cc:'SK',f:'🇸🇰',lat:48.15,lng:17.11,cap:true,cont:'EU'},
  // Americas
  {n:'New York',c:'USA',cc:'US',f:'🇺🇸',lat:40.713,lng:-74.006,cont:'NA'},
  {n:'Los Angeles',c:'USA',cc:'US',f:'🇺🇸',lat:34.052,lng:-118.244,cont:'NA'},
  {n:'Chicago',c:'USA',cc:'US',f:'🇺🇸',lat:41.878,lng:-87.630,cont:'NA'},
  {n:'Houston',c:'USA',cc:'US',f:'🇺🇸',lat:29.76,lng:-95.37,cont:'NA'},
  {n:'Miami',c:'USA',cc:'US',f:'🇺🇸',lat:25.77,lng:-80.19,cont:'NA'},
  {n:'San Francisco',c:'USA',cc:'US',f:'🇺🇸',lat:37.77,lng:-122.42,cont:'NA'},
  {n:'Seattle',c:'USA',cc:'US',f:'🇺🇸',lat:47.61,lng:-122.33,cont:'NA'},
  {n:'Washington D.C.',c:'USA',cc:'US',f:'🇺🇸',lat:38.91,lng:-77.04,cap:true,cont:'NA'},
  {n:'Las Vegas',c:'USA',cc:'US',f:'🇺🇸',lat:36.17,lng:-115.14,cont:'NA'},
  {n:'Boston',c:'USA',cc:'US',f:'🇺🇸',lat:42.36,lng:-71.06,cont:'NA'},
  {n:'Toronto',c:'Kanada',cc:'CA',f:'🇨🇦',lat:43.65,lng:-79.38,cont:'NA'},
  {n:'Vancouver',c:'Kanada',cc:'CA',f:'🇨🇦',lat:49.25,lng:-123.12,cont:'NA'},
  {n:'Montreal',c:'Kanada',cc:'CA',f:'🇨🇦',lat:45.5,lng:-73.57,cont:'NA'},
  {n:'Ottawa',c:'Kanada',cc:'CA',f:'🇨🇦',lat:45.42,lng:-75.7,cap:true,cont:'NA'},
  {n:'Mexico City',c:'Mexiko',cc:'MX',f:'🇲🇽',lat:19.43,lng:-99.13,cap:true,cont:'NA'},
  {n:'São Paulo',c:'Brasilien',cc:'BR',f:'🇧🇷',lat:-23.55,lng:-46.63,cont:'SA'},
  {n:'Rio de Janeiro',c:'Brasilien',cc:'BR',f:'🇧🇷',lat:-22.91,lng:-43.17,cont:'SA'},
  {n:'Brasília',c:'Brasilien',cc:'BR',f:'🇧🇷',lat:-15.78,lng:-47.93,cap:true,cont:'SA'},
  {n:'Buenos Aires',c:'Argentinien',cc:'AR',f:'🇦🇷',lat:-34.6,lng:-58.38,cap:true,cont:'SA'},
  {n:'Bogotá',c:'Kolumbien',cc:'CO',f:'🇨🇴',lat:4.71,lng:-74.07,cap:true,cont:'SA'},
  {n:'Lima',c:'Peru',cc:'PE',f:'🇵🇪',lat:-12.05,lng:-77.04,cap:true,cont:'SA'},
  {n:'Santiago',c:'Chile',cc:'CL',f:'🇨🇱',lat:-33.45,lng:-70.67,cap:true,cont:'SA'},
  {n:'Caracas',c:'Venezuela',cc:'VE',f:'🇻🇪',lat:10.5,lng:-66.92,cap:true,cont:'SA'},
  {n:'Havanna',c:'Kuba',cc:'CU',f:'🇨🇺',lat:23.14,lng:-82.36,cap:true,cont:'NA'},
  // Asia
  {n:'Tokio',c:'Japan',cc:'JP',f:'🇯🇵',lat:35.69,lng:139.69,cap:true,cont:'AS'},
  {n:'Osaka',c:'Japan',cc:'JP',f:'🇯🇵',lat:34.69,lng:135.5,cont:'AS'},
  {n:'Kyoto',c:'Japan',cc:'JP',f:'🇯🇵',lat:35.02,lng:135.76,cont:'AS'},
  {n:'Seoul',c:'Südkorea',cc:'KR',f:'🇰🇷',lat:37.57,lng:126.98,cap:true,cont:'AS'},
  {n:'Peking',c:'China',cc:'CN',f:'🇨🇳',lat:39.91,lng:116.39,cap:true,cont:'AS'},
  {n:'Shanghai',c:'China',cc:'CN',f:'🇨🇳',lat:31.23,lng:121.47,cont:'AS'},
  {n:'Shenzhen',c:'China',cc:'CN',f:'🇨🇳',lat:22.54,lng:114.06,cont:'AS'},
  {n:'Hongkong',c:'Hongkong',cc:'HK',f:'🇭🇰',lat:22.32,lng:114.17,cont:'AS'},
  {n:'Singapur',c:'Singapur',cc:'SG',f:'🇸🇬',lat:1.35,lng:103.82,cap:true,cont:'AS'},
  {n:'Bangkok',c:'Thailand',cc:'TH',f:'🇹🇭',lat:13.75,lng:100.52,cap:true,cont:'AS'},
  {n:'Jakarta',c:'Indonesien',cc:'ID',f:'🇮🇩',lat:-6.21,lng:106.85,cap:true,cont:'AS'},
  {n:'Kuala Lumpur',c:'Malaysia',cc:'MY',f:'🇲🇾',lat:3.14,lng:101.69,cap:true,cont:'AS'},
  {n:'Manila',c:'Philippinen',cc:'PH',f:'🇵🇭',lat:14.6,lng:120.98,cap:true,cont:'AS'},
  {n:'Ho-Chi-Minh-Stadt',c:'Vietnam',cc:'VN',f:'🇻🇳',lat:10.82,lng:106.63,cont:'AS'},
  {n:'Hanoi',c:'Vietnam',cc:'VN',f:'🇻🇳',lat:21.03,lng:105.85,cap:true,cont:'AS'},
  {n:'Mumbai',c:'Indien',cc:'IN',f:'🇮🇳',lat:19.08,lng:72.88,cont:'AS'},
  {n:'Delhi',c:'Indien',cc:'IN',f:'🇮🇳',lat:28.66,lng:77.23,cap:true,cont:'AS'},
  {n:'Bangalore',c:'Indien',cc:'IN',f:'🇮🇳',lat:12.97,lng:77.59,cont:'AS'},
  {n:'Karachi',c:'Pakistan',cc:'PK',f:'🇵🇰',lat:24.86,lng:67.01,cont:'AS'},
  {n:'Islamabad',c:'Pakistan',cc:'PK',f:'🇵🇰',lat:33.68,lng:73.05,cap:true,cont:'AS'},
  {n:'Dhaka',c:'Bangladesch',cc:'BD',f:'🇧🇩',lat:23.81,lng:90.41,cap:true,cont:'AS'},
  {n:'Kabul',c:'Afghanistan',cc:'AF',f:'🇦🇫',lat:34.53,lng:69.17,cap:true,cont:'AS'},
  {n:'Teheran',c:'Iran',cc:'IR',f:'🇮🇷',lat:35.69,lng:51.42,cap:true,cont:'AS'},
  {n:'Istanbul',c:'Türkei',cc:'TR',f:'🇹🇷',lat:41.01,lng:28.96,cont:'AS'},
  {n:'Ankara',c:'Türkei',cc:'TR',f:'🇹🇷',lat:39.93,lng:32.86,cap:true,cont:'AS'},
  {n:'Riad',c:'Saudi-Arabien',cc:'SA',f:'🇸🇦',lat:24.69,lng:46.72,cap:true,cont:'AS'},
  {n:'Dubai',c:'Vereinigte Arabische Emirate',cc:'AE',f:'🇦🇪',lat:25.2,lng:55.27,cont:'AS'},
  {n:'Abu Dhabi',c:'Vereinigte Arabische Emirate',cc:'AE',f:'🇦🇪',lat:24.47,lng:54.37,cap:true,cont:'AS'},
  {n:'Doha',c:'Katar',cc:'QA',f:'🇶🇦',lat:25.29,lng:51.53,cap:true,cont:'AS'},
  {n:'Tel Aviv',c:'Israel',cc:'IL',f:'🇮🇱',lat:32.09,lng:34.78,cont:'AS'},
  {n:'Jerusalem',c:'Israel',cc:'IL',f:'🇮🇱',lat:31.77,lng:35.23,cap:true,cont:'AS'},
  {n:'Beirut',c:'Libanon',cc:'LB',f:'🇱🇧',lat:33.89,lng:35.5,cap:true,cont:'AS'},
  {n:'Bagdad',c:'Irak',cc:'IQ',f:'🇮🇶',lat:33.34,lng:44.4,cap:true,cont:'AS'},
  {n:'Ulaanbaatar',c:'Mongolei',cc:'MN',f:'🇲🇳',lat:47.9,lng:106.88,cap:true,cont:'AS'},
  {n:'Kathmandu',c:'Nepal',cc:'NP',f:'🇳🇵',lat:27.7,lng:85.32,cap:true,cont:'AS'},
  {n:'Colombo',c:'Sri Lanka',cc:'LK',f:'🇱🇰',lat:6.93,lng:79.85,cap:true,cont:'AS'},
  {n:'Taipei',c:'Taiwan',cc:'TW',f:'🇹🇼',lat:25.05,lng:121.53,cap:true,cont:'AS'},
  // Africa
  {n:'Kairo',c:'Ägypten',cc:'EG',f:'🇪🇬',lat:30.06,lng:31.25,cap:true,cont:'AF'},
  {n:'Lagos',c:'Nigeria',cc:'NG',f:'🇳🇬',lat:6.45,lng:3.4,cont:'AF'},
  {n:'Kinshasa',c:'DR Kongo',cc:'CD',f:'🇨🇩',lat:-4.32,lng:15.32,cap:true,cont:'AF'},
  {n:'Johannesburg',c:'Südafrika',cc:'ZA',f:'🇿🇦',lat:-26.2,lng:28.04,cont:'AF'},
  {n:'Kapstadt',c:'Südafrika',cc:'ZA',f:'🇿🇦',lat:-33.93,lng:18.42,cont:'AF'},
  {n:'Pretoria',c:'Südafrika',cc:'ZA',f:'🇿🇦',lat:-25.74,lng:28.19,cap:true,cont:'AF'},
  {n:'Nairobi',c:'Kenia',cc:'KE',f:'🇰🇪',lat:-1.29,lng:36.82,cap:true,cont:'AF'},
  {n:'Addis Abeba',c:'Äthiopien',cc:'ET',f:'🇪🇹',lat:9.03,lng:38.74,cap:true,cont:'AF'},
  {n:'Dar es Salaam',c:'Tansania',cc:'TZ',f:'🇹🇿',lat:-6.79,lng:39.21,cont:'AF'},
  {n:'Casablanca',c:'Marokko',cc:'MA',f:'🇲🇦',lat:33.59,lng:-7.62,cont:'AF'},
  {n:'Rabat',c:'Marokko',cc:'MA',f:'🇲🇦',lat:34.01,lng:-6.84,cap:true,cont:'AF'},
  {n:'Algier',c:'Algerien',cc:'DZ',f:'🇩🇿',lat:36.74,lng:3.06,cap:true,cont:'AF'},
  {n:'Tunis',c:'Tunesien',cc:'TN',f:'🇹🇳',lat:36.82,lng:10.17,cap:true,cont:'AF'},
  {n:'Accra',c:'Ghana',cc:'GH',f:'🇬🇭',lat:5.56,lng:-0.2,cap:true,cont:'AF'},
  {n:'Dakar',c:'Senegal',cc:'SN',f:'🇸🇳',lat:14.69,lng:-17.45,cap:true,cont:'AF'},
  {n:'Khartoum',c:'Sudan',cc:'SD',f:'🇸🇩',lat:15.56,lng:32.53,cap:true,cont:'AF'},
  {n:'Abidjan',c:'Elfenbeinküste',cc:'CI',f:'🇨🇮',lat:5.35,lng:-4.0,cont:'AF'},
  {n:'Luanda',c:'Angola',cc:'AO',f:'🇦🇴',lat:-8.84,lng:13.23,cap:true,cont:'AF'},
  {n:'Maputo',c:'Mosambik',cc:'MZ',f:'🇲🇿',lat:-25.97,lng:32.57,cap:true,cont:'AF'},
  // Oceania
  {n:'Sydney',c:'Australien',cc:'AU',f:'🇦🇺',lat:-33.87,lng:151.21,cont:'OC'},
  {n:'Melbourne',c:'Australien',cc:'AU',f:'🇦🇺',lat:-37.81,lng:144.96,cont:'OC'},
  {n:'Brisbane',c:'Australien',cc:'AU',f:'🇦🇺',lat:-27.47,lng:153.03,cont:'OC'},
  {n:'Perth',c:'Australien',cc:'AU',f:'🇦🇺',lat:-31.95,lng:115.86,cont:'OC'},
  {n:'Canberra',c:'Australien',cc:'AU',f:'🇦🇺',lat:-35.28,lng:149.13,cap:true,cont:'OC'},
  {n:'Auckland',c:'Neuseeland',cc:'NZ',f:'🇳🇿',lat:-36.87,lng:174.77,cont:'OC'},
  {n:'Wellington',c:'Neuseeland',cc:'NZ',f:'🇳🇿',lat:-41.29,lng:174.78,cap:true,cont:'OC'},
  {n:'Suva',c:'Fidschi',cc:'FJ',f:'🇫🇯',lat:-18.14,lng:178.44,cap:true,cont:'OC'},
  {n:'Port Moresby',c:'Papua-Neuguinea',cc:'PG',f:'🇵🇬',lat:-9.44,lng:147.18,cap:true,cont:'OC'},
  // Russia / Central Asia
  {n:'Moskau',c:'Russland',cc:'RU',f:'🇷🇺',lat:55.75,lng:37.62,cap:true,cont:'EU'},
  {n:'Sankt Petersburg',c:'Russland',cc:'RU',f:'🇷🇺',lat:59.94,lng:30.32,cont:'EU'},
  {n:'Nowosibirsk',c:'Russland',cc:'RU',f:'🇷🇺',lat:55.03,lng:82.92,cont:'AS'},
  {n:'Jekaterinburg',c:'Russland',cc:'RU',f:'🇷🇺',lat:56.83,lng:60.6,cont:'EU'},
  {n:'Wladiwostok',c:'Russland',cc:'RU',f:'🇷🇺',lat:43.13,lng:131.9,cont:'AS'},
  {n:'Astana',c:'Kasachstan',cc:'KZ',f:'🇰🇿',lat:51.18,lng:71.45,cap:true,cont:'AS'},
  {n:'Taschkent',c:'Usbekistan',cc:'UZ',f:'🇺🇿',lat:41.3,lng:69.27,cap:true,cont:'AS'},
  // Caribbean / Pacific
  {n:'Nassau',c:'Bahamas',cc:'BS',f:'🇧🇸',lat:25.04,lng:-77.35,cap:true,cont:'NA'},
  {n:'Kingston',c:'Jamaika',cc:'JM',f:'🇯🇲',lat:18.0,lng:-76.79,cap:true,cont:'NA'},
  {n:'Port of Spain',c:'Trinidad und Tobago',cc:'TT',f:'🇹🇹',lat:10.65,lng:-61.52,cap:true,cont:'NA'},
  {n:'Honolulu',c:'USA (Hawaii)',cc:'US',f:'🇺🇸',lat:21.31,lng:-157.82,cont:'OC'},
  {n:'Papeete',c:'Französisch-Polynesien',cc:'PF',f:'🇵🇫',lat:-17.54,lng:-149.57,cap:true,cont:'OC'},
];
