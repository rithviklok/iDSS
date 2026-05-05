'use strict';

const http = require('http');
const urlModule = require('url');

const PORT = 3001;
const FRONTEND_ORIGIN = 'http://localhost:5173';

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const mockUser = {
    id: 'usr-001', name: 'Admin User', username: 'admin', role: 'SuperAdmin',
    districtId: 'uttar-pradesh-lucknow', wardIds: [], wards: [],
    permissions: ['manage_users','manage_sensors','view_reports','manage_interventions','approve_sops','view_dashboard'],
};

const mockDistricts = [
    { id: 'haryana-gurugram', name: 'Gurugram', state: 'Haryana', center: { lat: 28.4595, lng: 77.0266 }, zoom: 12,
      wards: Array.from({length:35},(_,i)=>({id:`haryana-gurugram-w${i+1}`,name:`Ward ${i+1}`,number:i+1})) },
    { id: 'uttar-pradesh-lucknow', name: 'Lucknow', state: 'Uttar Pradesh', center: { lat: 26.8312, lng: 80.889 }, zoom: 12,
      wards: Array.from({length:110},(_,i)=>({id:`uttar-pradesh-lucknow-w${i+1}`,name:`Ward ${i+1}`,number:i+1})) },
];

const gurugramSensors = [
    { id:'GUR-001', name:'Sector 14 Monitor',   location:{lat:28.4725,lng:77.0390}, pm25:83,  pm10:145, zone:1, ward:14, lastUpdated:new Date().toISOString(), isActive:true, co:1.1, no2:40, o3:35, windSpeed:10, rh:55, temp:28 },
    { id:'GUR-002', name:'Sector 29 Monitor',   location:{lat:28.4590,lng:77.0610}, pm25:107, pm10:195, zone:2, ward:29, lastUpdated:new Date().toISOString(), isActive:true, co:1.8, no2:55, o3:29, windSpeed:9,  rh:58, temp:29 },
    { id:'GUR-003', name:'Palam Vihar',         location:{lat:28.4830,lng:76.9920}, pm25:150, pm10:240, zone:3, ward:5,  lastUpdated:new Date().toISOString(), isActive:true, co:2.5, no2:70, o3:25, windSpeed:7,  rh:63, temp:30 },
    { id:'GUR-004', name:'DLF Phase 3',         location:{lat:28.4945,lng:77.0930}, pm25:78,  pm10:130, zone:1, ward:3,  lastUpdated:new Date().toISOString(), isActive:true, co:0.7, no2:28, o3:40, windSpeed:13, rh:52, temp:27 },
    { id:'GUR-005', name:'Sohna Road',          location:{lat:28.4132,lng:77.0640}, pm25:118, pm10:210, zone:4, ward:32, lastUpdated:new Date().toISOString(), isActive:true, co:1.6, no2:50, o3:31, windSpeed:11, rh:57, temp:29 },
    { id:'GUR-006', name:'Manesar Industrial',  location:{lat:28.3590,lng:76.9380}, pm25:216, pm10:340, zone:5, ward:35, lastUpdated:new Date().toISOString(), isActive:true },
    { id:'GUR-007', name:'IMT Manesar',         location:{lat:28.3650,lng:76.9500}, pm25:289, pm10:410, zone:5, ward:34, lastUpdated:new Date().toISOString(), isActive:true },
    { id:'GUR-008', name:'Cyber City',          location:{lat:28.4940,lng:77.0870}, pm25:52,  pm10:98,  zone:1, ward:2,  lastUpdated:new Date().toISOString(), isActive:true },
    { id:'GUR-009', name:'Golf Course Road',    location:{lat:28.4560,lng:77.1010}, pm25:77,  pm10:125, zone:2, ward:12, lastUpdated:new Date().toISOString(), isActive:true },
    { id:'GUR-010', name:'Sector 56',           location:{lat:28.4240,lng:77.0980}, pm25:130, pm10:220, zone:3, ward:22, lastUpdated:new Date().toISOString(), isActive:true },
    { id:'GUR-011', name:'Udyog Vihar',         location:{lat:28.4990,lng:77.0640}, pm25:105, pm10:185, zone:1, ward:1,  lastUpdated:new Date().toISOString(), isActive:true },
    { id:'GUR-012', name:'Huda Market Sec-14',  location:{lat:28.4680,lng:77.0230}, pm25:156, pm10:255, zone:3, ward:15, lastUpdated:new Date().toISOString(), isActive:true },
    { id:'GUR-015', name:'Farrukhnagar',        location:{lat:28.4480,lng:76.8210}, pm25:314, pm10:450, zone:7, ward:33, lastUpdated:new Date().toISOString(), isActive:true },
    { id:'GUR-020', name:'Wazirabad',           location:{lat:28.4530,lng:76.8950}, pm25:181, pm10:300, zone:6, ward:30, lastUpdated:new Date().toISOString(), isActive:true },
    { id:'GUR-025', name:'Old Gurugram',        location:{lat:28.4610,lng:77.0020}, pm25:186, pm10:310, zone:3, ward:16, lastUpdated:new Date().toISOString(), isActive:true },
];

const lucknowSensors = [
    { id:'LKO-001', name:'Hazratganj',       location:{lat:26.8513,lng:80.9462}, pm25:112, pm10:198, zone:1, ward:1,  lastUpdated:new Date().toISOString(), isActive:true, co:1.2, no2:45, o3:30, windSpeed:12, rh:65, temp:32 },
    { id:'LKO-002', name:'Aminabad',         location:{lat:26.8470,lng:80.9340}, pm25:145, pm10:245, zone:1, ward:3,  lastUpdated:new Date().toISOString(), isActive:true, co:2.1, no2:62, o3:28, windSpeed:8,  rh:70, temp:31 },
    { id:'LKO-003', name:'Chowk',            location:{lat:26.8610,lng:80.9350}, pm25:195, pm10:320, zone:2, ward:5,  lastUpdated:new Date().toISOString(), isActive:true, co:3.4, no2:88, o3:22, windSpeed:6,  rh:72, temp:33 },
    { id:'LKO-004', name:'Gomti Nagar',      location:{lat:26.8508,lng:80.9915}, pm25:67,  pm10:115, zone:3, ward:10, lastUpdated:new Date().toISOString(), isActive:true, co:0.8, no2:30, o3:38, windSpeed:15, rh:60, temp:30 },
    { id:'LKO-005', name:'Indira Nagar',     location:{lat:26.8750,lng:80.9920}, pm25:78,  pm10:130, zone:3, ward:12, lastUpdated:new Date().toISOString(), isActive:true, co:0.9, no2:35, o3:42, windSpeed:14, rh:58, temp:30 },
    { id:'LKO-006', name:'Aliganj',          location:{lat:26.8920,lng:80.9430}, pm25:92,  pm10:168, zone:4, ward:15, lastUpdated:new Date().toISOString(), isActive:true },
    { id:'LKO-007', name:'Mahanagar',        location:{lat:26.8740,lng:80.9500}, pm25:105, pm10:185, zone:2, ward:7,  lastUpdated:new Date().toISOString(), isActive:true },
    { id:'LKO-008', name:'Rajajipuram',      location:{lat:26.8550,lng:80.8950}, pm25:165, pm10:275, zone:5, ward:20, lastUpdated:new Date().toISOString(), isActive:true },
    { id:'LKO-009', name:'Alambagh',         location:{lat:26.8190,lng:80.9180}, pm25:210, pm10:345, zone:6, ward:25, lastUpdated:new Date().toISOString(), isActive:true },
    { id:'LKO-010', name:'Husainabad',       location:{lat:26.8680,lng:80.9190}, pm25:178, pm10:298, zone:2, ward:6,  lastUpdated:new Date().toISOString(), isActive:true },
    { id:'LKO-011', name:'Cantonment',       location:{lat:26.8330,lng:80.9330}, pm25:88,  pm10:152, zone:6, ward:28, lastUpdated:new Date().toISOString(), isActive:true },
    { id:'LKO-012', name:'Chinhat',          location:{lat:26.8740,lng:81.0230}, pm25:55,  pm10:95,  zone:3, ward:14, lastUpdated:new Date().toISOString(), isActive:true },
    { id:'LKO-013', name:'Jankipuram',       location:{lat:26.9150,lng:80.9620}, pm25:72,  pm10:125, zone:4, ward:16, lastUpdated:new Date().toISOString(), isActive:true },
    { id:'LKO-014', name:'Vikas Nagar',      location:{lat:26.8900,lng:80.9150}, pm25:98,  pm10:170, zone:4, ward:18, lastUpdated:new Date().toISOString(), isActive:true },
    { id:'LKO-015', name:'Telibagh',         location:{lat:26.7920,lng:80.9420}, pm25:135, pm10:228, zone:7, ward:30, lastUpdated:new Date().toISOString(), isActive:true },
    { id:'LKO-017', name:'Sarojini Nagar',   location:{lat:26.8050,lng:80.9110}, pm25:148, pm10:250, zone:6, ward:27, lastUpdated:new Date().toISOString(), isActive:true },
    { id:'LKO-018', name:'Talkatora',        location:{lat:26.8510,lng:80.9130}, pm25:187, pm10:308, zone:5, ward:22, lastUpdated:new Date().toISOString(), isActive:true },
    { id:'LKO-019', name:'Nishatganj',       location:{lat:26.8630,lng:80.9550}, pm25:130, pm10:218, zone:2, ward:8,  lastUpdated:new Date().toISOString(), isActive:true },
    { id:'LKO-020', name:'Kaiserbagh',       location:{lat:26.8430,lng:80.9390}, pm25:155, pm10:260, zone:1, ward:2,  lastUpdated:new Date().toISOString(), isActive:true },
    { id:'LKO-021', name:'Lalbagh',          location:{lat:26.8580,lng:80.9250}, pm25:168, pm10:282, zone:2, ward:4,  lastUpdated:new Date().toISOString(), isActive:true },
    { id:'LKO-027', name:'Charbagh',         location:{lat:26.8450,lng:80.9080}, pm25:195, pm10:318, zone:5, ward:21, lastUpdated:new Date().toISOString(), isActive:true },
    { id:'LKO-031', name:'Transport Nagar',  location:{lat:26.8930,lng:80.9280}, pm25:220, pm10:360, zone:4, ward:17, lastUpdated:new Date().toISOString(), isActive:true },
    { id:'LKO-036', name:'Old Lucknow Core', location:{lat:26.8590,lng:80.9050}, pm25:240, pm10:395, zone:5, ward:23, lastUpdated:new Date().toISOString(), isActive:true },
    { id:'LKO-037', name:'Gudamba',          location:{lat:26.8940,lng:80.8950}, pm25:185, pm10:305, zone:5, ward:42, lastUpdated:new Date().toISOString(), isActive:true },
    { id:'LKO-040', name:'Faizabad Road',    location:{lat:26.8820,lng:81.0000}, pm25:64,  pm10:112, zone:3, ward:13, lastUpdated:new Date().toISOString(), isActive:true },
];

const allSensorsMap = { 'haryana-gurugram': gurugramSensors, 'uttar-pradesh-lucknow': lucknowSensors };
function getSensors(districtId) { return allSensorsMap[districtId] || lucknowSensors; }
function getAllSensors() { return [...gurugramSensors, ...lucknowSensors]; }

const mockIssues = [
    { id:'ISS-2026-001', type:'road_dust',          title:'Road Dust',              description:'Heavy road dust resuspension due to unpaved shoulder.',       location:{lat:26.8610,lng:80.9350}, zone:7, ward:67, severity:'high',   status:'new',       pm25:195, pm10:320, createdAt:'2026-02-24T10:00:00+05:30', updatedAt:'2026-02-24T10:00:00+05:30', districtId:'uttar-pradesh-lucknow', detectedBy:'Mobile AQ Unit',      wind:'N at 7.2 km/h',  affectedWards:['Ward 67'], sourceContributors:[] },
    { id:'ISS-2026-002', type:'waste_burning',       title:'Waste Burning',          description:'Open MSW burning detected by thermal camera in Block C & D.', location:{lat:26.8190,lng:80.9180}, zone:4, ward:45, severity:'high',   status:'new',       pm25:340, pm10:510, createdAt:'2026-02-24T11:15:00+05:30', updatedAt:'2026-02-24T11:15:00+05:30', districtId:'uttar-pradesh-lucknow', detectedBy:'Thermal Camera',       wind:'NW at 5.1 km/h', affectedWards:['Ward 45'], sourceContributors:[] },
    { id:'ISS-2026-003', type:'traffic_congestion',  title:'Traffic Congestion',     description:'Gridlock causing high NOx and PM2.5.',                        location:{lat:26.8513,lng:80.9462}, zone:1, ward:12, severity:'high',   status:'active',    pm25:210, pm10:350, createdAt:'2026-02-24T08:30:00+05:30', updatedAt:'2026-02-25T14:00:00+05:30', districtId:'uttar-pradesh-lucknow', detectedBy:'Traffic Sensor Array', wind:'E at 3.4 km/h',  affectedWards:['Ward 12'], sourceContributors:[], assignedTo:'Officer Rajan' },
    { id:'ISS-2026-004', type:'construction_dust',   title:'Construction Dust',      description:'Uncovered construction site causing dust clouds.',             location:{lat:26.8470,lng:80.9340}, zone:2, ward:32, severity:'medium', status:'done',      pm25:145, pm10:240, createdAt:'2026-02-22T09:00:00+05:30', updatedAt:'2026-02-25T16:30:00+05:30', districtId:'uttar-pradesh-lucknow', detectedBy:'Field Inspection',     wind:'SW at 4.8 km/h', affectedWards:['Ward 32'], sourceContributors:[], assignedTo:'Officer Meena' },
    { id:'ISS-2026-005', type:'industrial_emission', title:'Industrial Emission',    description:'Unauthorized kiln operation detected near residential colony.', location:{lat:26.8930,lng:80.9280}, zone:5, ward:55, severity:'high',   status:'escalated', pm25:380, pm10:560, createdAt:'2026-02-23T07:00:00+05:30', updatedAt:'2026-02-25T18:00:00+05:30', districtId:'uttar-pradesh-lucknow', detectedBy:'CEMS Monitor',         wind:'NE at 6.0 km/h', affectedWards:['Ward 55'], sourceContributors:[], assignedTo:'CPCB Regional' },
    { id:'ISS-2026-006', type:'road_dust',          title:'Road Dust (NH-44)',        description:'Construction debris on highway shoulder.',                    location:{lat:28.4725,lng:77.0390}, zone:3, ward:28, severity:'medium', status:'active',    pm25:165, pm10:278, createdAt:'2026-02-25T06:45:00+05:30', updatedAt:'2026-02-25T12:00:00+05:30', districtId:'haryana-gurugram',      detectedBy:'Roadside Sensor',      wind:'W at 8.3 km/h',  affectedWards:['Ward 28'], sourceContributors:[], assignedTo:'Officer Anil' },
    { id:'ISS-2026-007', type:'waste_burning',       title:'Open Burning (Sector 56)',description:'Garden waste burning in open plot.',                          location:{lat:28.4240,lng:77.0980}, zone:3, ward:22, severity:'medium', status:'new',       pm25:180, pm10:295, createdAt:'2026-02-26T04:30:00+05:30', updatedAt:'2026-02-26T04:30:00+05:30', districtId:'haryana-gurugram',      detectedBy:'Citizen Complaint',    wind:'NW at 4.5 km/h', affectedWards:['Ward 22'], sourceContributors:[] },
    { id:'ISS-2026-008', type:'construction_dust',   title:'Metro Construction',      description:'Metro construction site without anti-smog gun.',              location:{lat:28.4945,lng:77.0930}, zone:1, ward:3,  severity:'high',   status:'active',    pm25:225, pm10:370, createdAt:'2026-02-24T15:30:00+05:30', updatedAt:'2026-02-25T10:00:00+05:30', districtId:'haryana-gurugram',      detectedBy:'Drone Surveillance',   wind:'SE at 5.7 km/h', affectedWards:['Ward 3'],  sourceContributors:[], assignedTo:'Officer Vikas' },
];

const mockTriggers = [
    { id:'trig-001', ruleId:'rule-001', ruleName:'Construction Dust Escalation',   severity:'severe',   status:'awaiting_approval', ward:'Ward 18, Aliganj',       wardNames:['Ward 18'], zoneName:'Zone 4', wind:'NW at 5 km/h',   detectedBy:'Sensor S-031',    districtId:'uttar-pradesh-lucknow', currentReading:'PM10: 387 µg/m³',          slaDeadline:new Date(Date.now()+4*3600000).toISOString(),  department:'Engineering (PWD)', budgetImpact:63000,  activatedAt:new Date(Date.now()-2*3600000).toISOString(),  suggestedInterventions:['Deploy Anti-Smog Gun','Dust Suppression Tanker','Notify Engineering Department'], sources:['Sensor S-031 (PM10: 387)','CCTV Cam-9'], affectedWards:['Ward 18','Ward 19'], interventionStatuses:{} },
    { id:'trig-002', ruleId:'rule-002', ruleName:'Open Waste Burning Detection',   severity:'severe',   status:'in_progress',        ward:'Ward 45, Indira Nagar',   wardNames:['Ward 45'], zoneName:'Zone 6', wind:'NW at 5.1 km/h', detectedBy:'CCTV Cam-14',     districtId:'uttar-pradesh-lucknow', currentReading:'PM2.5: 312 µg/m³',         slaDeadline:new Date(Date.now()+1*3600000).toISOString(),  department:'LMC - Sanitation',  budgetImpact:20000,  activatedAt:new Date(Date.now()-1*3600000).toISOString(),  suggestedInterventions:['Enforcement Drive','Penalty (repeat offender)','Waste Collection Redirection'], sources:['Sensor S-007','Complaint #C-4521'],           affectedWards:['Ward 45','Ward 46'], interventionStatuses:{0:{status:'completed'}} },
    { id:'trig-003', ruleId:'rule-004', ruleName:'Road Dust Hotspot Response',     severity:'moderate', status:'in_progress',        ward:'Faizabad Road Corridor',  wardNames:['Ward 13'], zoneName:'Zone 3', wind:'E at 3.4 km/h',  detectedBy:'Traffic IoT Hub', districtId:'uttar-pradesh-lucknow', currentReading:'PM10 Cluster: 265-298 µg/m³', slaDeadline:new Date(Date.now()+6*3600000).toISOString(),  department:'Engineering (PWD)', budgetImpact:152000, activatedAt:new Date(Date.now()-8*3600000).toISOString(),  suggestedInterventions:['Mechanized Road Sweeping','Shoulder Stabilization','Static ASG Deployment'],    sources:['Sensor S-012','Sensor S-014'],                affectedWards:['Ward 13','Ward 40'], interventionStatuses:{} },
    { id:'trig-004', ruleId:'rule-001', ruleName:'Construction Dust Escalation',   severity:'moderate', status:'awaiting_approval',  ward:'Ward 32, Gomti Nagar',    wardNames:['Ward 32'], zoneName:'Zone 3', wind:'SW at 4.8 km/h', detectedBy:'Field Inspection', districtId:'uttar-pradesh-lucknow', currentReading:'PM10: 245 µg/m³',           slaDeadline:new Date(Date.now()+3*3600000).toISOString(),  department:'Engineering (PWD)', budgetImpact:18000,  activatedAt:new Date(Date.now()-1.5*3600000).toISOString(),suggestedInterventions:['Water Sprinkling','Site Compliance Notice'],                                      sources:['Sensor S-019 (PM10: 245)'],                   affectedWards:['Ward 32'], interventionStatuses:{} },
    { id:'trig-005', ruleId:'rule-002', ruleName:'Open Waste Burning Detection',   severity:'advisory', status:'completed',          ward:'Ward 52, Chinhat',        wardNames:['Ward 52'], zoneName:'Zone 3', wind:'N at 4.2 km/h',  detectedBy:'Citizen Complaint',districtId:'uttar-pradesh-lucknow', currentReading:'PM2.5: 198 µg/m³',          slaDeadline:new Date(Date.now()-1*3600000).toISOString(),  department:'LMC - Sanitation',  budgetImpact:3000,   activatedAt:new Date(Date.now()-4*3600000).toISOString(),  suggestedInterventions:['Verification Visit','Awareness Drive'],                                          sources:['Complaint #C-4518','Sensor S-023'],            affectedWards:['Ward 52'], interventionStatuses:{0:{status:'completed'},1:{status:'completed'}}, completion:{remarks:'No burning found, complaint closed',completedAt:new Date(Date.now()-0.5*3600000).toISOString(),completedBy:'Team Bravo'} },
];

const mockRules = [
    { id:'rule-001', name:'Construction Dust Escalation',  description:'Auto-triggered when PM10 exceeds NAAQS threshold for 3 consecutive intervals.', status:'triggered', conditions:[], interventions:[{id:'i1',name:'Deploy Anti-Smog Gun',estimatedCost:45000,budgetCode:'LMC-DUST-2026-Q1',fundSource:'NCAP Fund'},{id:'i2',name:'Dust Suppression Tanker',estimatedCost:18000,budgetCode:'LMC-DUST-2026-Q1',fundSource:'Municipal Budget'}], workflowChain:['JE','AE','Executive Engineer','Deployment'], department:'Engineering (PWD)',    slaHours:4,   approvalMode:'manual', triggerCount:8,  impactMetrics:{estimatedPollutantReduction:'25-40% PM10 reduction',affectedPopulation:12400,healthBenefit:'Reduced respiratory distress'} },
    { id:'rule-002', name:'Open Waste Burning Detection',   description:'Triggers enforcement when PM2.5 spikes >60% above rolling baseline.',           status:'triggered', conditions:[], interventions:[{id:'i4',name:'Enforcement Drive',estimatedCost:8000,budgetCode:'LMC-ENF-2026',fundSource:'Sanitation Budget'},{id:'i5',name:'Penalty (repeat offender)',estimatedCost:-25000,budgetCode:'LMC-REV',fundSource:'Recovery'}],                  workflowChain:['ICCC','Ward Team','Zonal Officer','Enforcement'],  department:'LMC - Sanitation', slaHours:1,   approvalMode:'auto',   triggerCount:12, impactMetrics:{estimatedPollutantReduction:'Source elimination within 1 hour',affectedPopulation:8200,healthBenefit:'Immediate smoke exposure reduction'} },
    { id:'rule-003', name:'Severe AQI Emergency Protocol',  description:'City-wide emergency response when AQI exceeds 400 for 48 continuous hours.',   status:'active',    conditions:[], interventions:[{id:'i7',name:'Temporary Construction Closures',estimatedCost:0,budgetCode:'DM-EMR',fundSource:'Emergency Order'},{id:'i8',name:'Activate War Room',estimatedCost:150000,budgetCode:'ICCC-OPS',fundSource:'NCAP Fund'}],                workflowChain:['ICCC','District Administration','District Magistrate'],           department:'District Administration', slaHours:0.5, approvalMode:'manual', triggerCount:3,  impactMetrics:{estimatedPollutantReduction:'15-20% city-wide AQI improvement',affectedPopulation:3500000,healthBenefit:'Reduced severe respiratory cases by ~30%'} },
    { id:'rule-004', name:'Road Dust Hotspot Response',     description:'Auto-deploy mechanized sweeping when spatial clustering of PM10 detected.',     status:'triggered', conditions:[], interventions:[{id:'i11',name:'Mechanized Road Sweeping',estimatedCost:22000,budgetCode:'ENG-SWEEP-2026',fundSource:'Municipal Budget'},{id:'i12',name:'Shoulder Stabilization',estimatedCost:85000,budgetCode:'PWD-INFRA',fundSource:'15th Finance Commission'}], workflowChain:['JE','AE','Executive Engineer'],                            department:'Engineering (PWD)',    slaHours:6,   approvalMode:'auto',   triggerCount:19, impactMetrics:{estimatedPollutantReduction:'30-45% PM10 reduction along 2.3 km stretch',affectedPopulation:22000,healthBenefit:'Reduced chronic dust exposure'} },
];

const mockCapacity = [
    { department:'Engineering (PWD)',     resources:[{name:'Anti-Smog Guns',total:6,available:2,deployed:4},{name:'Water Tankers',total:12,available:5,deployed:7},{name:'Mechanized Sweepers',total:8,available:3,deployed:5},{name:'Field Teams',total:10,available:4,deployed:6}], pendingActions:3, avgResponseTime:'1h 42m', slaCompliance:72,  overdueCount:2, budgetUtilized:1245000, budgetAllocated:2500000 },
    { department:'LMC - Sanitation',      resources:[{name:'Enforcement Teams',total:8,available:3,deployed:5},{name:'Waste Collection Vehicles',total:15,available:6,deployed:9},{name:'Zonal Officers',total:5,available:2,deployed:3}],                                            pendingActions:2, avgResponseTime:'48m',    slaCompliance:85,  overdueCount:1, budgetUtilized:680000,  budgetAllocated:1200000 },
    { department:'District Administration',resources:[{name:'War Room Staff',total:12,available:12,deployed:0},{name:'Emergency Vehicles',total:4,available:4,deployed:0}],                                                                                                          pendingActions:0, avgResponseTime:'2h 15m',  slaCompliance:100, overdueCount:0, budgetUtilized:185000,  budgetAllocated:5000000 },
    { department:'UPPCB',                 resources:[{name:'Inspection Teams',total:4,available:2,deployed:2},{name:'Lab Analysis Slots',total:10,available:4,deployed:6}],                                                                                                          pendingActions:1, avgResponseTime:'3h 20m',  slaCompliance:68,  overdueCount:1, budgetUtilized:420000,  budgetAllocated:800000 },
];

const mockSimulations = [
    { ruleId:'rule-001', ruleName:'Construction Dust Escalation',  triggerCount:34, avgSlaAdherence:71,  estimatedReduction:'~18% PM10 reduction in affected wards',      budgetSpend:2142000, topCategory:'Construction Dust' },
    { ruleId:'rule-002', ruleName:'Open Waste Burning Detection',   triggerCount:47, avgSlaAdherence:83,  estimatedReduction:'Source elimination in 89% of cases',          budgetSpend:564000,  topCategory:'Waste Burning' },
    { ruleId:'rule-003', ruleName:'Severe AQI Emergency Protocol',  triggerCount:2,  avgSlaAdherence:100, estimatedReduction:'~16% city-wide AQI improvement',              budgetSpend:370000,  topCategory:'Multi-source Emergency' },
    { ruleId:'rule-004', ruleName:'Road Dust Hotspot Response',     triggerCount:58, avgSlaAdherence:65,  estimatedReduction:'~32% PM10 reduction on treated corridors',    budgetSpend:8874000, topCategory:'Road Dust' },
];

const mockHotspots = {
    'uttar-pradesh-lucknow': [
        { id:'HS-L1', location:{lat:26.8590,lng:80.9050}, intensity:92, label:'Old Lucknow',    isHotspot:true,  conditionsMet:3, maxConsecDays:5, foe:0.88, condition1:true,  condition2:true,  condition3:true  },
        { id:'HS-L2', location:{lat:26.8930,lng:80.9280}, intensity:88, label:'Transport Nagar',isHotspot:true,  conditionsMet:3, maxConsecDays:4, foe:0.82, condition1:true,  condition2:true,  condition3:true  },
        { id:'HS-L3', location:{lat:26.8190,lng:80.9180}, intensity:80, label:'Alambagh',       isHotspot:true,  conditionsMet:2, maxConsecDays:3, foe:0.75, condition1:true,  condition2:true,  condition3:false },
        { id:'HS-L4', location:{lat:26.8610,lng:80.9350}, intensity:75, label:'Chowk',          isHotspot:true,  conditionsMet:2, maxConsecDays:3, foe:0.70, condition1:true,  condition2:false, condition3:true  },
        { id:'HS-L5', location:{lat:26.8450,lng:80.9080}, intensity:62, label:'Charbagh',       isHotspot:false, conditionsMet:1, maxConsecDays:2, foe:0.55, condition1:true,  condition2:false, condition3:false },
    ],
    'haryana-gurugram': [
        { id:'HS-G1', location:{lat:28.4480,lng:76.8210}, intensity:95, label:'Farrukhnagar Zone',isHotspot:true,  conditionsMet:3, maxConsecDays:6, foe:0.91, condition1:true, condition2:true,  condition3:true  },
        { id:'HS-G2', location:{lat:28.3650,lng:76.9500}, intensity:88, label:'IMT Manesar',      isHotspot:true,  conditionsMet:3, maxConsecDays:5, foe:0.85, condition1:true, condition2:true,  condition3:true  },
        { id:'HS-G3', location:{lat:28.4610,lng:77.0020}, intensity:72, label:'Old Gurugram',     isHotspot:true,  conditionsMet:2, maxConsecDays:3, foe:0.68, condition1:true, condition2:true,  condition3:false },
        { id:'HS-G4', location:{lat:28.4560,lng:77.0610}, intensity:65, label:'Sector 29',        isHotspot:false, conditionsMet:1, maxConsecDays:2, foe:0.58, condition1:true, condition2:false, condition3:false },
    ],
};

const mockContributions = {
    'uttar-pradesh-lucknow': [
        { id:'SC-L1', location:{lat:26.86,lng:80.93}, sources:[{label:'Vehicular',percentage:35,color:'#f39c12'},{label:'Road Dust',percentage:28,color:'#9b59b6'},{label:'Waste Burning',percentage:18,color:'#e74c3c'},{label:'Industrial',percentage:12,color:'#3498db'},{label:'Other',percentage:7,color:'#95a5a6'}] },
        { id:'SC-L2', location:{lat:26.85,lng:80.99}, sources:[{label:'Vehicular',percentage:50,color:'#f39c12'},{label:'Construction',percentage:20,color:'#3498db'},{label:'Road Dust',percentage:15,color:'#9b59b6'},{label:'Industrial',percentage:10,color:'#e74c3c'},{label:'Other',percentage:5,color:'#95a5a6'}] },
        { id:'SC-L3', location:{lat:26.89,lng:80.92}, sources:[{label:'Industrial',percentage:40,color:'#e74c3c'},{label:'Vehicular',percentage:30,color:'#f39c12'},{label:'Road Dust',percentage:20,color:'#9b59b6'},{label:'Other',percentage:10,color:'#95a5a6'}] },
    ],
    'haryana-gurugram': [
        { id:'SC-G1', location:{lat:28.46,lng:76.90}, sources:[{label:'Industrial',percentage:42,color:'#e74c3c'},{label:'Vehicular',percentage:25,color:'#f39c12'},{label:'Road Dust',percentage:20,color:'#9b59b6'},{label:'Construction',percentage:8,color:'#3498db'},{label:'Other',percentage:5,color:'#95a5a6'}] },
        { id:'SC-G2', location:{lat:28.48,lng:77.07}, sources:[{label:'Vehicular',percentage:45,color:'#f39c12'},{label:'Road Dust',percentage:22,color:'#9b59b6'},{label:'Construction',percentage:18,color:'#3498db'},{label:'Industrial',percentage:10,color:'#e74c3c'},{label:'Other',percentage:5,color:'#95a5a6'}] },
    ],
};

const mockTeam = [
    { id:'usr-001', name:'Admin User',   username:'admin', role:'SuperAdmin',   wardIds:[],       wards:[],                                                                                supervisorId:null     },
    { id:'usr-002', name:'Officer Rajan',username:'rajan', role:'FieldOfficer', wardIds:[12,13],  wards:[{wardName:'Ward 12',wardNumber:12},{wardName:'Ward 13',wardNumber:13}],             supervisorId:'usr-001' },
    { id:'usr-003', name:'Officer Meena',username:'meena', role:'FieldOfficer', wardIds:[32,33],  wards:[{wardName:'Ward 32',wardNumber:32},{wardName:'Ward 33',wardNumber:33}],             supervisorId:'usr-001' },
    { id:'usr-004', name:'Officer Vikas',username:'vikas', role:'ZonalOfficer', wardIds:[1,2,3,4],wards:[{wardName:'Ward 1',wardNumber:1},{wardName:'Ward 2',wardNumber:2}],                 supervisorId:'usr-001' },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function json(res, data, status) {
    res.writeHead(status || 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

function readBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', (c) => { body += c.toString(); });
        req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
    });
}

function setCors(req, res) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || FRONTEND_ORIGIN);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cookie');
    res.setHeader('Vary', 'Origin');
}

function genReadings(sensorId, hours) {
    const rows = [], now = Date.now(), base = 80 + Math.floor(Math.random() * 100);
    for (let i = hours * 4; i >= 0; i--) {
        rows.push({ sensorId, sensorName: sensorId, timestamp: new Date(now - i * 15 * 60000).toISOString(),
            source: 'mock', pm25: Math.max(5, Math.round(base + (Math.random()-0.5)*40)),
            windSpeed: Math.round((5+Math.random()*10)*10)/10, windDir: Math.floor(Math.random()*360) });
    }
    return rows;
}

function genGrid(districtId) {
    const sensors = getSensors(districtId);
    if (!sensors.length) return null;
    const lats = sensors.map(s=>s.location.lat), lngs = sensors.map(s=>s.location.lng);
    const bounds = { north:Math.max(...lats)+0.02, south:Math.min(...lats)-0.02, east:Math.max(...lngs)+0.02, west:Math.min(...lngs)-0.02 };
    const rows=10, cols=10, values=[];
    for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
        const lat=bounds.south+(r/rows)*(bounds.north-bounds.south);
        const lng=bounds.west+(c/cols)*(bounds.east-bounds.west);
        let ws=0, wt=0;
        for (const s of sensors) { const d=Math.hypot(lat-s.location.lat,lng-s.location.lng)||0.001; const w=1/(d*d); ws+=s.pm25*w; wt+=w; }
        values.push([lat, lng, Math.round(ws/wt)]);
    }
    const vals=values.map(v=>v[2]);
    return { districtId, mode:'idw', generatedAt:new Date().toISOString(), sensorCount:sensors.length,
        sensors:sensors.map(s=>({sensorId:s.id,name:s.name,lat:s.location.lat,lng:s.location.lng,pm25:s.pm25,timestamp:s.lastUpdated,source:'mock'})),
        grid:{ rows, columns:cols, values, bounds, resolutionDeg:0.01 },
        statistics:{ min:Math.min(...vals), max:Math.max(...vals), mean:Math.round(vals.reduce((a,b)=>a+b,0)/vals.length), stdDev:30 },
        interpolation:'IDW (power=2)', degraded:false, cacheHit:false };
}

function genForecast(districtId, hours) {
    const sensors=getSensors(districtId), now=Date.now();
    const avg=sensors.length ? Math.round(sensors.reduce((s,x)=>s+x.pm25,0)/sensors.length) : 100;
    const forecast=[], stns=[];
    for (let i=0;i<hours;i++) {
        const pm25=Math.max(10,Math.round(avg+(Math.random()-0.5)*40-i*0.3));
        const aqi=pm25<30?50:pm25<60?100:pm25<90?150:pm25<120?200:pm25<250?300:400;
        const category=aqi<=50?'Good':aqi<=100?'Satisfactory':aqi<=200?'Moderate':aqi<=300?'Poor':aqi<=400?'Very Poor':'Severe';
        forecast.push({ timestamp:new Date(now+i*3600000).toISOString(), pm25, aqi, category });
    }
    sensors.slice(0,5).forEach(s=>{
        stns.push({ sensorId:s.id, lat:s.location.lat, lng:s.location.lng, avgPm25:s.pm25, peakPm25:Math.round(s.pm25*1.2), trend:s.pm25>150?'improving':'stable',
            forecasts:Array.from({length:24},(_,i)=>({timestamp:new Date(now+i*3600000).toISOString(),pm25:Math.max(10,Math.round(s.pm25+(Math.random()-0.5)*30))})) });
    });
    return { forecast, stations:stns, model:'Mock-LSTM-v1', generatedAt:new Date().toISOString() };
}

// ─── SESSION STORE ────────────────────────────────────────────────────────────

const sessions = new Set();

function isAuth(req) {
    const m = (req.headers.cookie||'').match(/dss_session=([^;]+)/);
    return m ? sessions.has(m[1]) : false;
}

// ─── ROUTER ───────────────────────────────────────────────────────────────────

async function router(req, res) {
    setCors(req, res);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const parsed = urlModule.parse(req.url, true);
    const path = (parsed.pathname||'').replace(/\/$/, '') || '/';
    const q = parsed.query;

    console.log(req.method, path);

    // ── AUTH ─────────────────────────────────────────────────────────────────
    if (req.method==='GET' && path==='/auth/profile') {
        return isAuth(req) ? json(res, mockUser) : json(res, {message:'Not authenticated'}, 401);
    }
    if (req.method==='POST' && path==='/auth/login') {
        const b = await readBody(req);
        if (!b.username) return json(res, {message:'Username required'}, 400);
        const tok = `mock-${Date.now()}`;
        sessions.add(tok);
        res.setHeader('Set-Cookie', `dss_session=${tok}; Path=/; HttpOnly; SameSite=Lax`);
        return json(res, { user: { ...mockUser, username: b.username } });
    }
    if (req.method==='POST' && path==='/auth/logout') {
        const m = (req.headers.cookie||'').match(/dss_session=([^;]+)/);
        if (m) sessions.delete(m[1]);
        res.setHeader('Set-Cookie', 'dss_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
        return json(res, {message:'Logged out'});
    }
    if (req.method==='POST' && path==='/auth/signup')      return json(res, {message:'Account created. Awaiting admin approval.'});
    if (req.method==='POST' && path==='/auth/create-user') return json(res, {message:'User created successfully.'});
    if (req.method==='GET'  && path==='/auth/team')        return json(res, {team: mockTeam});

    // ── GEOGRAPHY ────────────────────────────────────────────────────────────
    if (req.method==='GET' && path==='/geography/states')    return json(res, {states:['Haryana','Uttar Pradesh']});
    if (req.method==='GET' && path==='/geography/districts') {
        const list = q.state ? mockDistricts.filter(d=>d.state===q.state) : mockDistricts;
        return json(res, {districts: list});
    }
    if (req.method==='GET' && path==='/geography/wards') {
        const d = mockDistricts.find(x=>x.id===q.districtId);
        return json(res, {wards: d ? d.wards : []});
    }
    const dm = path.match(/^\/geography\/districts\/(.+)$/);
    if (req.method==='GET' && dm) {
        const d = mockDistricts.find(x=>x.id===decodeURIComponent(dm[1]));
        return d ? json(res, d) : json(res, {message:'District not found'}, 404);
    }

    // ── SENSORS ──────────────────────────────────────────────────────────────
    if (req.method==='GET' && path==='/sensors') {
        let list = getSensors(q.districtId || 'uttar-pradesh-lucknow');
        if (q.wardNumber) list = list.filter(s=>s.ward===parseInt(q.wardNumber));
        return json(res, {sensors: list});
    }
    if (req.method==='GET' && path==='/sensors/heatmap') {
        const list = getSensors(q.districtId || 'uttar-pradesh-lucknow');
        const lats=list.map(s=>s.location.lat), lngs=list.map(s=>s.location.lng);
        return json(res, { points:list.map(s=>({lat:s.location.lat,lng:s.location.lng,value:s.pm25})),
            bounds:{north:Math.max(...lats)+0.05,south:Math.min(...lats)-0.05,east:Math.max(...lngs)+0.05,west:Math.min(...lngs)-0.05}, timestamp:new Date().toISOString() });
    }
    if (req.method==='GET' && path==='/sensors/readings') {
        return json(res, {readings: genReadings(q.sensorId||'LKO-001', parseInt(q.hours||'24'))});
    }
    const ssm = path.match(/^\/sensors\/([^/]+)\/sources$/);
    if (req.method==='GET' && ssm) {
        return json(res, { sensorId:decodeURIComponent(ssm[1]), hasSources:true,
            sources:[{label:'Road Dust',percentage:32},{label:'Vehicular',percentage:28},{label:'Construction',percentage:20},{label:'Industrial',percentage:12},{label:'Other',percentage:8}],
            sourceOrigin:'heuristic',
            sopResult:{ sopTriggered:true, triggerId:'trig-001', trigger:{ deviceId:ssm[1], ruleId:'rule-001', ruleName:'Construction Dust Escalation', severity:'moderate', sopType:'immediate', leadingSource:'Road Dust', issueType:'road_dust', intervention:{ sensor_issue_type:'road_dust', intervention_description:'Deploy mechanized road sweeping', estimated_cost_min:15000, estimated_cost_max:25000, sla_hours:4, primary_department:'Engineering (PWD)' }, pm25Category:'Poor' } },
            affectedWards:['Ward 12','Ward 13'], message:'Source apportionment from heuristic model.', timestamp:new Date().toISOString() });
    }

    // ── ISSUES ───────────────────────────────────────────────────────────────
    if (req.method==='GET' && path==='/issues/stats') {
        const list = q.districtId ? mockIssues.filter(i=>i.districtId===q.districtId) : mockIssues;
        return json(res, { total:list.length,
            byStatus:list.reduce((a,i)=>{a[i.status]=(a[i.status]||0)+1;return a},{}),
            bySeverity:list.reduce((a,i)=>{a[i.severity]=(a[i.severity]||0)+1;return a},{}),
            byType:list.reduce((a,i)=>{a[i.type]=(a[i.type]||0)+1;return a},{}) });
    }
    if (req.method==='GET' && path==='/issues') {
        let list = q.districtId ? mockIssues.filter(i=>i.districtId===q.districtId) : mockIssues;
        if (q.status) list = list.filter(i=>i.status===q.status);
        return json(res, {issues: list});
    }
    const isom = path.match(/^\/issues\/([^/]+)\/sops$/);
    if (req.method==='GET' && isom) {
        return json(res, {sops:[{id:`sop-${isom[1]}-1`,ruleName:'Construction Dust Escalation',severity:'high',status:'in_progress',sop_type:'immediate',department:'Engineering (PWD)',pollutionSource:'Construction Dust',pollutionSourcePct:45,activatedAt:new Date(Date.now()-2*3600000).toISOString(),slaDeadline:new Date(Date.now()+2*3600000).toISOString()}]});
    }
    const ism = path.match(/^\/issues\/([^/]+)\/status$/);
    if (req.method==='PATCH' && ism) {
        const b=await readBody(req), iss=mockIssues.find(i=>i.id===decodeURIComponent(ism[1]));
        if (!iss) return json(res,{message:'Not found'},404);
        iss.status=b.status; iss.updatedAt=new Date().toISOString();
        return json(res, iss);
    }
    const ibm = path.match(/^\/issues\/([^/]+)$/);
    if (req.method==='GET' && ibm) {
        const iss=mockIssues.find(i=>i.id===decodeURIComponent(ibm[1]));
        return iss ? json(res,iss) : json(res,{message:'Not found'},404);
    }

    // ── MAP ──────────────────────────────────────────────────────────────────
    if (req.method==='GET' && path==='/map/hotspots') {
        const h = mockHotspots[q.districtId] || mockHotspots['uttar-pradesh-lucknow'];
        return json(res, {hotspots: h});
    }
    if (req.method==='GET' && path==='/map/source-contributions') {
        const c = mockContributions[q.districtId] || mockContributions['uttar-pradesh-lucknow'];
        return json(res, {contributions: c});
    }
    if (req.method==='GET' && path==='/map/pollution-grid') {
        const g = genGrid(q.districtId || 'uttar-pradesh-lucknow');
        return g ? json(res,g) : json(res,{message:'Not enough sensors'},422);
    }
    if (req.method==='GET' && path==='/map/forecast') {
        return json(res, genForecast(q.districtId||'uttar-pradesh-lucknow', parseInt(q.hours||'72')));
    }
    const spm = path.match(/^\/map\/source-pinpointing\/sensors\/([^/]+)$/);
    if (req.method==='GET' && spm) {
        const sid=decodeURIComponent(spm[1]), sensors=getSensors(q.districtId||'uttar-pradesh-lucknow');
        const s=sensors.find(x=>x.id===sid)||sensors[0];
        return json(res, { districtId:q.districtId||'uttar-pradesh-lucknow', computedAt:new Date().toISOString(),
            contributionHourStart:new Date(Date.now()-3600000).toISOString(), contributionHourEnd:new Date().toISOString(),
            sensor:{ sensorId:s.id, sensorName:s.name, deviceType:'CAAQMS', lat:s.location.lat, lng:s.location.lng,
                latestPm25:s.pm25, latestWindSpeed:s.windSpeed||8, latestWindDir:270, latestObservationTime:new Date().toISOString(), outsideSourcesPct:22,
                wardContributions:[{wardId:'w1',wardName:'Ward 12',gridCount:12,rawPercentage:38,percentage:38},{wardId:'w2',wardName:'Ward 13',gridCount:8,rawPercentage:25,percentage:25},{wardId:'w3',wardName:'Ward 11',gridCount:5,rawPercentage:15,percentage:15}] } });
    }

    // ── DSS ──────────────────────────────────────────────────────────────────
    if (req.method==='GET' && path==='/dss/triggers') {
        let list = q.districtId ? mockTriggers.filter(t=>t.districtId===q.districtId) : mockTriggers;
        if (q.ward) list = list.filter(t=>t.wardNames&&t.wardNames.includes(`Ward ${q.ward}`));
        return json(res, {triggers: list});
    }
    if (req.method==='GET' && path==='/dss/rules')       return json(res, {rules: mockRules});
    if (req.method==='GET' && path==='/dss/stats') {
        const iss = q.districtId ? mockIssues.filter(i=>i.districtId===q.districtId) : mockIssues;
        const trg = q.districtId ? mockTriggers.filter(t=>t.districtId===q.districtId) : mockTriggers;
        return json(res, { openIssuesCount:iss.filter(i=>i.status==='new'||i.status==='active').length,
            criticalIssuesCount:iss.filter(i=>i.severity==='high'&&(i.status==='new'||i.status==='active')).length,
            pendingSopsCount:trg.filter(t=>t.status==='awaiting_approval'||t.status==='in_progress').length });
    }
    if (req.method==='GET' && path==='/dss/capacity')    return json(res, {capacity: mockCapacity});
    if (req.method==='GET' && path==='/dss/simulations') return json(res, {simulations: mockSimulations});

    const tim = path.match(/^\/dss\/triggers\/([^/]+)\/issue$/);
    if (req.method==='GET' && tim) {
        const t=mockTriggers.find(x=>x.id===decodeURIComponent(tim[1]));
        if (!t) return json(res,{issue:null});
        const iss=mockIssues.find(i=>i.ward===(typeof t.ward==='number'?t.ward:null));
        return json(res,{issue:iss?{id:iss.id,type:iss.type,title:iss.title,status:iss.status,severity:iss.severity}:null});
    }
    const tcm = path.match(/^\/dss\/triggers\/([^/]+)\/complete$/);
    if (req.method==='POST' && tcm) {
        const t=mockTriggers.find(x=>x.id===decodeURIComponent(tcm[1]));
        if (!t) return json(res,{message:'Not found'},404);
        t.status='completed'; t.completion={remarks:'Completed',completedAt:new Date().toISOString(),completedBy:'Admin User'};
        return json(res,{id:t.id,status:'completed'});
    }
    const tivm = path.match(/^\/dss\/triggers\/([^/]+)\/interventions\/(\d+)\/status$/);
    if (req.method==='POST' && tivm) {
        const t=mockTriggers.find(x=>x.id===decodeURIComponent(tivm[1]));
        if (!t) return json(res,{message:'Not found'},404);
        if (!t.interventionStatuses) t.interventionStatuses={};
        t.interventionStatuses[parseInt(tivm[2])]={status:'completed'};
        return json(res,{interventionStatuses:t.interventionStatuses});
    }
    const tbm = path.match(/^\/dss\/triggers\/([^/]+)$/);
    if (req.method==='GET' && tbm) {
        const t=mockTriggers.find(x=>x.id===decodeURIComponent(tbm[1]));
        return t ? json(res,t) : json(res,{message:'Not found'},404);
    }

    // ── CONFIGURATOR ─────────────────────────────────────────────────────────
    if (req.method==='GET' && path==='/configurator/sensors/health') {
        const all=getAllSensors();
        const hs=all.map(s=>({ id:s.id, name:s.name, network:s.id.startsWith('LKO')?'Lucknow CAAQMS':'Gurugram CAAQMS',
            state:s.id.startsWith('LKO')?'Uttar Pradesh':'Haryana', district:s.id.startsWith('LKO')?'Lucknow':'Gurugram',
            zone:`Zone ${s.zone}`, zoneId:s.zone, ward:s.ward,
            status:s.isActive?(s.pm25>300?'Anomalous':'Active'):'Offline',
            healthScore:s.isActive?(s.pm25>300?65:92):30, uptimePct:s.isActive?97.2:45.0, completenessPct:s.isActive?98.5:60.0,
            lastDataAt:s.lastUpdated, qualityClass:s.pm25>200?'C':s.pm25>100?'B':'A', currentPm25:s.pm25,
            lat:s.location.lat, lng:s.location.lng, failedChecks:s.pm25>300?['PM spike detected']:[] }));
        return json(res,{summary:{total:hs.length,active:hs.filter(s=>s.status==='Active').length,anomalous:hs.filter(s=>s.status==='Anomalous').length,offline:hs.filter(s=>s.status==='Offline').length},sensors:hs});
    }
    if (req.method==='GET' && path==='/configurator/sensors') {
        const all=getAllSensors(), page=parseInt(q.page||'1'), limit=parseInt(q.limit||'20');
        const paged=all.slice((page-1)*limit, page*limit);
        return json(res,{sensors:paged.map(s=>({id:s.id,displayId:s.id,name:s.name,network:s.id.startsWith('LKO')?'CAAQMS-UP':'CAAQMS-HR',state:s.id.startsWith('LKO')?'Uttar Pradesh':'Haryana',district:s.id.startsWith('LKO')?'Lucknow':'Gurugram',districtId:s.id.startsWith('LKO')?'uttar-pradesh-lucknow':'haryana-gurugram',zone:`Zone ${s.zone}`,zoneId:s.zone,ward:s.ward,lat:s.location.lat,lng:s.location.lng,isActive:s.isActive,status:s.isActive?'Active':'Offline',deviceType:'CAAQMS',calibrationDate:'2026-01-15T00:00:00.000Z',lastSyncedAt:s.lastUpdated})),pagination:{page,limit,total:all.length,totalPages:Math.ceil(all.length/limit)}});
    }
    if (req.method==='POST' && path==='/configurator/sensors') {
        const b=await readBody(req);
        return json(res,{...b,id:`SEN-${Date.now()}`,displayId:`SEN-${Date.now()}`},201);
    }
    if (req.method==='POST' && path==='/configurator/sensors/bulk-import') {
        return json(res,{imported:0,errors:[],message:'Bulk import processed'});
    }
    const csm = path.match(/^\/configurator\/sensors\/([^/]+)$/);
    if (csm) {
        const b=await readBody(req);
        if (req.method==='PUT')    return json(res,{...b,id:decodeURIComponent(csm[1])});
        if (req.method==='DELETE') return json(res,{message:'Sensor deleted successfully'});
    }

    // ── 404 ──────────────────────────────────────────────────────────────────
    json(res, {message:`Not found: ${path}`}, 404);
}

http.createServer(router).listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('===========================================');
    console.log('  DSS Mock API Server');
    console.log(`  http://localhost:${PORT}`);
    console.log('  Login: any username + any password');
    console.log('===========================================');
    console.log('');
});
