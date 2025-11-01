const STORAGE_KEY = 'dashboard-reports';

function saveReports(reports) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

function loadReports() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

function showSection(name) {
  ['report','track','live'].forEach(sec=>{
    document.getElementById('section-' + sec).style.display = (sec===name?'block':'none');
  });
  document.querySelectorAll('.menu-item').forEach(mi=>mi.classList.remove('active'));
  let idx={'report':0,'track':1,'live':2}[name];
  if(idx!==undefined) document.querySelectorAll('.menu-item')[idx].classList.add('active');
  if(name==='track') renderTrackList();
  if(name==='live') initLiveMap();
}

let currLatLng = null;
let reportMap = null;
let reportMarker = null;
let imgData = null;

function initReportMap() {
  if(reportMap) return;
  reportMap = L.map('issue-map').setView([12.9716, 77.5946], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(reportMap);
  reportMarker = L.marker([12.9716, 77.5946], {draggable:true}).addTo(reportMap);
  reportMarker.on('dragend', function(e){
    currLatLng = e.target.getLatLng();
    updateCoordsLabel();
  });
  reportMap.on('click', function(e){
    currLatLng = e.latlng;
    reportMarker.setLatLng(e.latlng);
    updateCoordsLabel();
  });
  document.getElementById('issue-image').onchange = function(e){
    let file = e.target.files[0];
    if(file){
      let reader = new FileReader();
      reader.onload = ev=>{
        imgData = ev.target.result;
        document.getElementById('img-preview').innerHTML = `<img class="img-thumb" src="${imgData}"/>`;
      };
      reader.readAsDataURL(file);
    } else {
      imgData = null;
      document.getElementById('img-preview').innerHTML = "";
    }
  }
}

function getLocation() {
  if (!navigator.geolocation) {
    alert("Geolocation not supported by your browser.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    function(position) {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      // Center map, move marker
      if(reportMap && reportMarker) {
        reportMap.setView([lat, lng], 17);
        reportMarker.setLatLng([lat, lng]);
        currLatLng = { lat, lng };
        updateCoordsLabel();
        reportMarker.bindPopup("You are here!").openPopup();
      }
      // For debugging, print to console and check with Google Maps
      console.log("CURRENT LOCATION:", lat, lng);
    },
    function(err) {
      alert("Could not get your location: " + err.message);
      console.error(err);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}


function updateCoordsLabel() {
  let d = currLatLng ? `📍 ${currLatLng.lat.toFixed(6)}, ${currLatLng.lng.toFixed(6)}` : '';
  document.getElementById('coords-label').textContent = d;
}
document.addEventListener("DOMContentLoaded", ()=>{
  initReportMap();
});
setTimeout(initReportMap,600);

document.getElementById('reportForm').onsubmit = function(e){
  e.preventDefault();
  const t = document.getElementById('issue-title').value.trim();
  const type = document.getElementById('issue-type').value;
  const desc = document.getElementById('issue-desc').value.trim();
  const loc = currLatLng ? { lat: currLatLng.lat, lng: currLatLng.lng } : null;
  if(!loc) { alert("Please pick a location!"); return; }
  const id = "POT-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random()*9000);
  let reports = loadReports();
  reports.unshift({
    id: id, title: t, type, desc, loc,
    img: imgData, time: new Date().toLocaleString(),
    progress: 25, status: "Pending"
  });
  saveReports(reports);
  this.reset();
  imgData = null;
  document.getElementById('img-preview').innerHTML = '';
  currLatLng = null;
  updateCoordsLabel();
  showSection('track');
};

function renderTrackList() {
  const list = loadReports();
  let html = list.length ? "" : "<div>No reports yet.</div>";
  list.forEach(r=>{
    html += `<div class="report-block">
      <span class="report-title">${r.title}</span>
      <span class="status-chip">${r.status}</span>
      <div class="report-id">ID: ${r.id}</div>
      <div class="progress-bar-outer"><div class="progress-bar-inner" style="width:${r.progress}%"></div></div>
      <div class="report-details-row">
        <span>Progress <b>${r.progress}%</b> → </span>
        <span>📍 ${r.loc.lat.toFixed(6)}, ${r.loc.lng.toFixed(6)}</span>
        <span class="track-date">🗓 ${r.time}</span>
      </div>
      ${r.img ? `<img class="img-thumb" src="${r.img}"/>` : ''}
    </div>`;
  });
  document.getElementById('track-list').innerHTML = html;
}

let liveMap = null;
let routeLine = null;
let fromMarker = null;
let toMarker = null;

function initLiveMap() {
  if (!liveMap) {
    liveMap = L.map('live-map').setView([12.9716, 77.5946], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(liveMap);
  }
  // Setup map click handlers (optional)
}

function planRoute() {
  if (!liveMap) {
    alert("Map not initialized"); return;
  }
  let fromVal = document.getElementById('from-location').value.trim();
  let toVal = document.getElementById('to-location').value.trim();
  if (!fromVal || !toVal) {
    document.getElementById('journey-status').textContent = "Please pick both points.";
    return;
  }
  // Acceptable user input: "12.97,77.59" (lat,lng)
  let fromArr = fromVal.split(',').map(Number);
  let toArr = toVal.split(',').map(Number);

  // Prepare for API: (lng,lat) order
  if (fromArr.length !== 2 || toArr.length !== 2 || 
      fromArr.some(isNaN) || toArr.some(isNaN)) {
    document.getElementById('journey-status').textContent = "Invalid coordinate format!";
    return;
  }

  let url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${CONFIG.OPENROUTESERVICE_API_KEY}&start=${fromArr[1]},${fromArr[0]}&end=${toArr[1]},${toArr[0]}`;
  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(res.status + " " + res.statusText);
      return res.json();
    })
    .then(data => {
      if (typeof routeLine !== 'undefined' && routeLine && liveMap.hasLayer(routeLine)) {
        liveMap.removeLayer(routeLine);
      }
      const coords = data.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
      routeLine = L.polyline(coords, { color: 'gold', weight: 5 }).addTo(liveMap);
      liveMap.fitBounds(routeLine.getBounds());
      document.getElementById('journey-status').textContent = "Route mapped successfully!";
    })
    .catch(err => {
      document.getElementById('journey-status').textContent = "Could not fetch route! (" + err.message + ")";
      console.error("Route fetch error:", err);
    });
}
// Example for fetching weather by city name
const city = "Bangalore";
const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=metric`;

fetch(url)
  .then(res => res.json())
  .then(data => {
    // Use weather data
    console.log(data);
  });
