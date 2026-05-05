const fs = require('fs');
const path = require('path');

const wards = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/ward-boundaries.json'), 'utf8'));

// Ward name -> Zone number mapping from user's table
const wardToZone = {
  // Zone-1
  'Hazratganj-Ramtirath': 1, 'Lalkuwan': 1, 'Vikramaditya': 1,
  'Rajaram Mohan Rai': 1, 'J.C.Bose': 1, 'Babu Banarasi Das': 1,
  'Mahatma Gandhi': 1, 'Golaganj': 1, 'Basheeratganj - Ganeshganj': 1,
  'Yadunath Sanyal': 1, 'Nazarbagh': 1, 'Maulviganj': 1,
  'Mashakganj-Wazirganj': 1, 'Rani laxmibai': 1, 'Nazarbagh-Yadunath Sanyal': 1,

  // Zone-2
  'Ambedkar Nagar': 2, 'Malviya Nagar': 2, 'Aishbagh': 2,
  'Motilal Nehru - Chandra Bhanu Gupta Nagar': 2, 'Kunwar Jyoti Prsad': 2,
  'Labour colony': 2, 'Harideen Rai Nagar': 2, 'Rajaji Puram': 2,
  'Rajendra Nagar': 2, 'Yahiyaganj  - Neta Subhash Chandra Bose': 2,
  'Yahiyaganj - Neta Subhash Chandra Bose': 2, 'Raja Bazar': 2,
  'Tilak Nagar -Kundri Rakabganj': 2, 'Tilak Nagar -Kundri rakabganj': 2,

  // Zone-3
  'Jankipuram 1': 3, 'Jankipuram 2': 3, 'Jankipuram 3': 3,
  'Daliganj - Nirala Nagar': 3, 'Mahakavi Jaishankar Prasad': 3,
  'Faizullaganj-2': 3, 'Faizullaganj 1': 3, 'Faizullaganj 2': 3,
  'Faizullaganj 3': 3, 'Faizullaganj 4': 3, 'Faijullganj-2': 3,
  'Ayodhyadas': 3, 'Ayodhyadas 1': 3, 'Ayodhyadas 2': 3,
  'Lala Lajpat Rai': 3, 'Mankameshwar Mandir': 3,
  'Bhartendu Harishchandra': 3, 'Mahanagar': 3, 'Triveni Nagar': 3,
  'Kadam Rasool': 3, 'Vivekanandpuri': 3, 'Vivekanand Puri': 3,
  'Begum Hazrat Mahal - Bajrangbali': 3, 'Aliganj': 3,

  // Zone-4
  'Papermill': 4, 'Paper Mill': 4, 'Chinhat 1': 4, 'Chinhat 2': 4,
  'Colvin College': 4, 'Rafi Ahmad Kidwai': 4, 'Rafi Ahmad Kadwai': 4,
  'Rafi Ahmed Kidwai': 4, 'Gomti nagar': 4, 'Rajeev Gandhi 1': 4,
  'Rajeev Gandhi 2': 4, 'Arjun Ganj-Sirsawa': 4, 'Arjunganj Sirsawa': 4,
  'Malhaur Bharwara': 4, 'Ward No. 14 Bharwara Malhaur': 4,
  'Ward No. 12 Khargapur': 4,

  // Zone-5
  'Sarojani nagar 1': 5, 'Sarojani nagar 2': 5, 'Guru Nanak Nagar': 5,
  'Keshri Khera': 5, 'Keshri Kheda': 5,
  'Ramji Lal - Sardar Patel Nagar': 5, 'Guru Govind Singh': 5,
  'Om Nagar': 5, 'Chitragupta Nagar': 5, 'Babu Kunj Bihari': 5,
  'Geetapalli': 5,

  // Zone-6
  'Haiderganj 3': 6, 'Haider ganj 3': 6, 'Haiderganj 2': 6,
  'Haider ganj 1': 6, 'Sahadatganj': 6, 'Balaganj': 6,
  'Alamnagar': 6, 'Kanhaiya - Madhopur 2': 6, 'Kanhaiya Madhopur 1': 6,
  'Mallahitola 1': 6, 'Mallahitola 2': 6, 'Sheetladevi': 6,
  'Hussainabad': 6, 'Daulatganj': 6, 'Garhi peer khan': 6,
  'Amberganj': 6, 'Acharya Narendra Dev': 6, 'Ashrfabad': 6,
  'Maulana Kalbeabid 1': 6, 'Maulana Kalbe abid 2': 6,
  'mohd. Kalbe abid': 6, 'Kashmir Mohall': 6, 'Kashmir Mohalla': 6,
  'Bhawani ganj': 6, 'Chauk-Bazar Kaliji': 6,
  'Ward No. 9 M. Kalyan Singh': 6, 'M. Kalyan Singh': 6,
  'Ward No. 7 Lal ji Tandon': 6, 'M. Lalji Tandon': 6,

  // Zone-7
  'shaheed bhagat singh 1': 7, 'shaheed bhagat singh 2': 7,
  'Sahid Bhagat Singh': 7, 'Lal bahadur shastri 1': 7,
  'Lal Bahadur Shastri 2': 7, 'Lal Bahadur Shashtri 1': 7,
  'Indira Priyadarshini': 7, 'Shankar Purwa 1': 7,
  'Shankar Purwa 2': 7, 'Shankar Purwa 3': 7, 'Shankar purwa 3': 7,
  'Ismailganj 1': 7, 'Ismailganj 2': 7,
  'Babu Jagjeevan Ram': 7, 'Babu JagJeevan Ram': 7,
  'Maithili Sharan Gupt': 7, 'Lohiya Nagar': 7,
  'Indira Nagar': 7,

  // Zone-8
  'Raja bijli pase 2': 8, 'Raja Bijli Pasi 1': 8,
  'Ward NO. 1 Atal Bihari Vajpayee': 8, 'M. Atal Bihari Vajpayee': 8,
  'Sharda Nagar 1': 8, 'Sharda Nagar 2': 8,
  'Ibrahimpur': 8, 'Ibrahimpur 1': 8, 'Ibrahimpur 2': 8,
  'Hind Nagar': 8, 'Kharika 1': 8, 'Kharika 2': 8,
  'Vidyawati 1': 8, 'Vidyawati 2': 8, 'Vidyawati 3': 8,
};

let enriched = 0;
let fromHtml = 0;
let fromTable = 0;
let unmatched = [];

wards.features.forEach(f => {
  const html = (f.properties.description && f.properties.description.value) || '';
  const wardMatch = html.match(/<td>Ward_No<\/td>\s*<td>(\d+)<\/td>/);
  const zoneMatch = html.match(/<td>Zone_no<\/td>\s*<td>(\d+)<\/td>/);
  const areaMatch = html.match(/<td>Area<\/td>\s*<td>([\d.]+)<\/td>/);

  let zoneNo = zoneMatch ? parseInt(zoneMatch[1]) : null;
  let wardNo = wardMatch ? parseInt(wardMatch[1]) : null;
  let area = areaMatch ? parseFloat(areaMatch[1]) : null;

  // If zone not in HTML, look up from mapping table
  if (zoneNo === null) {
    const name = f.properties.name;
    if (wardToZone[name] !== undefined) {
      zoneNo = wardToZone[name];
      fromTable++;
    } else {
      // Try case-insensitive match
      const key = Object.keys(wardToZone).find(k => 
        k.toLowerCase().replace(/\s+/g, ' ').trim() === name.toLowerCase().replace(/\s+/g, ' ').trim()
      );
      if (key) {
        zoneNo = wardToZone[key];
        fromTable++;
      } else {
        unmatched.push(name);
      }
    }
  } else {
    fromHtml++;
  }

  // Clean up properties - remove HTML junk, add structured data
  f.properties = {
    name: f.properties.name,
    ward_no: wardNo,
    zone_no: zoneNo,
    zone_name: zoneNo ? `Zone-${zoneNo}` : null,
    area_sqkm: area,
  };

  if (zoneNo !== null) enriched++;
});

fs.writeFileSync(
  path.join(__dirname, '../public/ward-boundaries.json'),
  JSON.stringify(wards, null, 2)
);

console.log(`Total wards: ${wards.features.length}`);
console.log(`Enriched with zone: ${enriched} (${fromHtml} from HTML, ${fromTable} from mapping table)`);
if (unmatched.length > 0) {
  console.log(`Unmatched wards: ${unmatched.join(', ')}`);
}
