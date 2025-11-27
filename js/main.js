const STORAGE_KEY = 'dashboard-reports';

// Save reports to localStorage
function saveReports(reports) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

// Load reports from localStorage
function loadReports() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

// Show specific section
function showSection(name) {
  ['report', 'track', 'live', 'leaderboard'].forEach(sec => {
    const el = document.getElementById('section-' + sec);
    if (el) el.style.display = (sec === name ? 'block' : 'none');
  });
  document.querySelectorAll('.menu-item').forEach(mi => mi.classList.remove('active'));
  let idx = { 'report': 0, 'track': 1, 'live': 2, 'leaderboard': 3 }[name];
  if (idx !== undefined) document.querySelectorAll('.menu-item')[idx].classList.add('active');
  if (name === 'track') renderTrackList();
  if (name === 'live') initLiveMap();
  if (name === 'leaderboard') renderLeaderboard();
}

let currLatLng = null;
let reportMap = null;
let reportMarker = null;
let imgData = null;

// Simple example: user name from prompt, you can improve with login/session
let currentUserName = localStorage.getItem('username') || prompt("Enter your name for leaderboard:") || 'Anonymous';
localStorage.setItem('username', currentUserName);
 
// Map init for reporting
function initReportMap() {
  if (reportMap) return;
  reportMap = L.map('issue-map').setView([12.9716, 77.5946], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(reportMap);
  reportMarker = L.marker([12.9716, 77.5946], { draggable: true }).addTo(reportMap);
  reportMarker.on('dragend', function (e) {
    currLatLng = e.target.getLatLng();
    updateCoordsLabel();
  });
  reportMap.on('click', function (e) {
    currLatLng = e.latlng;
    reportMarker.setLatLng(e.latlng);
    updateCoordsLabel();
  });
  document.getElementById('issue-image').onchange = function (e) {
    let file = e.target.files[0];
    if (file) {
      let reader = new FileReader();
      reader.onload = ev => {
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
    function (position) {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      if (reportMap && reportMarker) {
        reportMap.setView([lat, lng], 17);
        reportMarker.setLatLng([lat, lng]);
        currLatLng = { lat, lng };
        updateCoordsLabel();
        reportMarker.bindPopup("You are here!").openPopup();
      }
      console.log("CURRENT LOCATION:", lat, lng);
    },
    function (err) {
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
document.addEventListener("DOMContentLoaded", () => {
  initReportMap();
});
setTimeout(initReportMap, 600);

// Report form handler
document.getElementById('reportForm').onsubmit = function (e) {
  e.preventDefault();
  const t = document.getElementById('issue-title').value.trim();
  const type = document.getElementById('issue-type').value;
  const desc = document.getElementById('issue-desc').value.trim();
  const loc = currLatLng ? { lat: currLatLng.lat, lng: currLatLng.lng } : null;
  if (!loc) { alert("Please pick a location!"); return; }
  const id = "POT-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000);

  let reports = loadReports();
  reports.unshift({
    id: id, title: t, type, desc, loc,
    img: imgData, time: new Date().toLocaleString(),
    progress: 25, status: "Pending",
    name: currentUserName // <-- Include name for leaderboard!
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
  list.forEach(r => {
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
  let fromArr = fromVal.split(',').map(Number);
  let toArr = toVal.split(',').map(Number);

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

// -------- LEADERBOARD LOGIC --------

// Compute leaderboard stats from reports
function computeLeaderboard() {
  const reports = loadReports();
  let userStats = {};
  reports.forEach(report => {
    if (report.status === 'Resolved' || report.status === 'Done') {
      const name = report.name || 'Anonymous';
      if (!userStats[name]) userStats[name] = { name, solved: 0, points: 0 };
      userStats[name].solved += 1;
      userStats[name].points += 10; // Each resolved issue = 10 points
    }
  });
  let lbArr = Object.values(userStats).sort((a, b) =>
    b.solved - a.solved || b.points - a.points
  );
  lbArr.forEach((user, i) => {
    user.rank = i + 1;
    if (i === 0) user.badge = '🥇 Gold';
    else if (i === 1) user.badge = '🥈 Silver';
    else if (i === 2) user.badge = '🥉 Bronze';
    else user.badge = 'Keep reporting issues!';
  });
  return lbArr;
}

// Display leaderboard
function renderLeaderboard() {
  let tbody = document.querySelector("#leaderboard-table tbody");
  if (!tbody) return;
  let lbData = computeLeaderboard();
  if (!lbData.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#ffd357;">🏆 No leaderboard entries yet!</td></tr>`;
    return;
  }
  tbody.innerHTML = lbData.map(user => `
      <tr>
        <td>${user.rank}</td>
        <td>
          <img src="${user.userPhoto}" alt="profile"
            style="width:32px;height:32px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:8px;">
          ${user.user}
        </td>


        <td>${user.solved}</td>
        <td>${user.points}</td>
        <td class="badge">${user.badge}</td>
      </tr>`).join("");
}

// ------- End of Leaderboard logic ------

// Example for fetching weather by city name
const city = "Bangalore";
const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=metric`;

fetch(url)
  .then(res => res.json())
  .then(data => {
    // Use weather data
    console.log(data);
  });

