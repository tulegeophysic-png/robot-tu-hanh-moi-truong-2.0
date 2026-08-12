// =======================================================
// AURABOT AI - DASHBOARD LOGIC
// =======================================================

const CONFIG = {
    PM25_LIMIT_WARN: 50,
    PM25_LIMIT_DANGER: 100,
    CO2_LIMIT_WARN: 1200,
    TEMP_LIMIT_HIGH: 35,
    HUMIDITY_LIMIT_HIGH: 75
};

let lastTelegramAlertTime = 0;
let envChart = null;
let envHistoryLogs = [];

const rooms = [
    { id: 'room-living', name: 'Phòng Khách', aqiEl: 'aqi-living' },
    { id: 'room-bed', name: 'Phòng Ngủ', aqiEl: 'aqi-bed' },
    { id: 'room-kitchen', name: 'Phòng Bếp', aqiEl: 'aqi-kitchen' },
    { id: 'room-office', name: 'Phòng Làm Việc', aqiEl: 'aqi-office' }
];
let currentRoomIndex = 0;

const elTemp = document.getElementById('val-temp');
const elHumidity = document.getElementById('val-humidity');
const elPm25 = document.getElementById('val-pm25');
const elCo2 = document.getElementById('val-co2');
const elLogConsole = document.getElementById('log-console');

// KHỞI TẠO BIỂU ĐỒ CHART.JS
function initChart() {
    const ctx = document.getElementById('envChart').getContext('2d');
    envChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Nhiệt độ (°C)', borderColor: '#f97316', data: [], fill: false, tension: 0.3 },
                { label: 'Bụi PM2.5 (µg/m³)', borderColor: '#a855f7', data: [], fill: false, tension: 0.3 },
                { label: 'CO₂ (x10 ppm)', borderColor: '#10b981', data: [], fill: false, tension: 0.3 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
            },
            plugins: { legend: { labels: { color: '#f8fafc' } } }
        }
    });
}

function updateChart(data) {
    if (!envChart) return;
    const now = new Date().toLocaleTimeString();

    if (envChart.data.labels.length > 8) {
        envChart.data.labels.shift();
        envChart.data.datasets.forEach(ds => ds.data.shift());
    }

    envChart.data.labels.push(now);
    envChart.data.datasets[0].data.push(data.temperature);
    envChart.data.datasets[1].data.push(data.pm25);
    envChart.data.datasets[2].data.push((data.co2 / 10).toFixed(0));
    envChart.update();
}

// BẢN ĐỒ NHIỆT (HEATMAP 2D)
function updateHeatmap(currentRoom, data) {
    rooms.forEach(room => {
        const roomBox = document.getElementById(room.id);
        const aqiText = document.getElementById(room.aqiEl);

        if (room.id === currentRoom.id) {
            roomBox.classList.add('has-robot');
            roomBox.classList.remove('safe', 'warning', 'danger');
            
            if (data.pm25 > CONFIG.PM25_LIMIT_DANGER) {
                roomBox.classList.add('danger');
                aqiText.textContent = "Xấu / Ô Nhiễm";
            } else if (data.pm25 > CONFIG.PM25_LIMIT_WARN) {
                roomBox.classList.add('warning');
                aqiText.textContent = "Trung bình";
            } else {
                roomBox.classList.add('safe');
                aqiText.textContent = "Tốt / Sạch";
            }
        } else {
            roomBox.classList.remove('has-robot');
        }
    });
}

// ĐIỀU KHIỂN THIẾT BỊ SMART HOME
function setDeviceStatus(deviceId, switchId, isTurnOn) {
    const devElement = document.getElementById(deviceId);
    const switchElement = document.getElementById(switchId);

    if (isTurnOn) {
        devElement.classList.add('active');
        switchElement.checked = true;
    } else {
        devElement.classList.remove('active');
        switchElement.checked = false;
    }
}

function toggleDeviceManual(deviceId, isChecked) {
    const devName = document.querySelector(`#${deviceId} h4`).textContent;
    if (isChecked) {
        document.getElementById(deviceId).classList.add('active');
        addLog(`[SMART HOME] Người dùng đã BẬT thủ công: ${devName}`, 'info');
    } else {
        document.getElementById(deviceId).classList.remove('active');
        addLog(`[SMART HOME] Người dùng đã TẮT thủ công: ${devName}`, 'warn');
    }
}

function handleSmartHomeAutomation(data) {
    if (data.pm25 > CONFIG.PM25_LIMIT_WARN) {
        setDeviceStatus('device-air-purifier', 'switch-air-purifier', true);
    }
    if (data.temperature > CONFIG.TEMP_LIMIT_HIGH || data.humidity > CONFIG.HUMIDITY_LIMIT_HIGH) {
        setDeviceStatus('device-ac', 'switch-ac', true);
    }
    if (data.co2 > CONFIG.CO2_LIMIT_WARN) {
        setDeviceStatus('device-fan', 'switch-fan', true);
    }
}

// THÔNG BÁO TỰ ĐỘNG
function triggerAlertNotifications(roomName, data) {
    if (data.pm25 > CONFIG.PM25_LIMIT_DANGER) {
        const currentTime = Date.now();
        if (currentTime - lastTelegramAlertTime > 8000) {
            lastTelegramAlertTime = currentTime;
            const msg = `📲 [TELEGRAM BOT] ⚠️ CẢNH BÁO NGUY HIỂM tại [${roomName}]: PM2.5 = ${data.pm25}µg/m³, CO2 = ${data.co2}ppm. Đã bật máy lọc không khí!`;
            addLog(msg, 'telegram');
        }
    }
}

// XUẤT BÁO CÁO EXCEL / CSV
document.getElementById('btn-export-excel').addEventListener('click', () => {
    if (envHistoryLogs.length === 0) {
        alert("Chưa có đủ dữ liệu lịch sử để xuất báo cáo!");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,Thoi Gian,Vi Tri Phong,Nhiet Do (C),Do Am (%),Bui PM2.5,Khi CO2 (ppm)\n";
    envHistoryLogs.forEach(row => {
        csvContent += `${row.time},${row.room},${row.temp},${row.humidity},${row.pm25},${row.co2}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Bao_Cao_Moi_Truong_AuraBot.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addLog("[SYSTEM] Đã xuất thành công file Báo cáo CSV/Excel!", "info");
});

// TRỢ LÝ GIỌNG NÓI AI
function speakText(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

document.getElementById('btn-speak-ai').addEventListener('click', () => {
    const currentRoom = rooms[currentRoomIndex].name;
    const pm25Val = elPm25.textContent;
    const tempVal = elTemp.textContent;

    let voiceMsg = `Robot đang ở ${currentRoom}. Nhiệt độ là ${tempVal} độ, bụi mịn P M 2.5 là ${pm25Val}. `;
    if (parseFloat(pm25Val) > 50) {
        voiceMsg += `Không khí chưa tốt, đã kích hoạt máy lọc không khí tự động.`;
    } else {
        voiceMsg += `Chất lượng không khí an toàn.`;
    }

    speakText(voiceMsg);
    addLog("[AI VOICE] Đã phát báo cáo giọng nói tiếng Việt.", "info");
});

// NHẬT KÝ & VÒNG LẶP CHÍNH
function addLog(message, type = "info") {
    const timeStr = new Date().toLocaleTimeString();
    const logItem = document.createElement('p');
    logItem.className = `log-item ${type}`;
    logItem.textContent = `[${timeStr}] ${message}`;
    elLogConsole.appendChild(logItem);
    elLogConsole.scrollTop = elLogConsole.scrollHeight;
}

function readSensors() {
    return {
        temperature: parseFloat((Math.random() * (38 - 22) + 22).toFixed(1)),
        humidity: parseFloat((Math.random() * (80 - 45) + 45).toFixed(1)),
        pm25: parseFloat((Math.random() * (140 - 15) + 15).toFixed(1)),
        co2: parseFloat((Math.random() * (1500 - 400) + 400).toFixed(0))
    };
}

function runSystemLoop() {
    const sensorData = readSensors();
    const currentRoom = rooms[currentRoomIndex];

    elTemp.textContent = sensorData.temperature;
    elHumidity.textContent = sensorData.humidity;
    elPm25.textContent = sensorData.pm25;
    elCo2.textContent = sensorData.co2;

    envHistoryLogs.push({
        time: new Date().toLocaleTimeString(),
        room: currentRoom.name,
        temp: sensorData.temperature,
        humidity: sensorData.humidity,
        pm25: sensorData.pm25,
        co2: sensorData.co2
    });

    updateChart(sensorData);
    updateHeatmap(currentRoom, sensorData);
    handleSmartHomeAutomation(sensorData);
    triggerAlertNotifications(currentRoom.name, sensorData);

    addLog(`[SENSORS] Quét vị trí ${currentRoom.name}: PM2.5 = ${sensorData.pm25} µg/m³, CO2 = ${sensorData.co2} ppm.`, "info");

    currentRoomIndex = (currentRoomIndex + 1) % rooms.length;
}

window.onload = () => {
    initChart();
    runSystemLoop();
    setInterval(runSystemLoop, 3500);
};