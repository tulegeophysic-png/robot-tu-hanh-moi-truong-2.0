// =======================================================
// AURABOT AI - DASHBOARD SCRIPT FULL 4 TÁC VỤ
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
let envHistoryLogs = []; // Lưu trữ để xuất Excel/Report

// Danh sách các phòng để Robot di chuyển và tô màu Heatmap
const rooms = [
    { id: 'room-living', name: 'Phòng Khách', aqiEl: 'aqi-living' },
    { id: 'room-bed', name: 'Phòng Ngủ', aqiEl: 'aqi-bed' },
    { id: 'room-kitchen', name: 'Phòng Bếp', aqiEl: 'aqi-kitchen' },
    { id: 'room-office', name: 'Phòng Làm Việc', aqiEl: 'aqi-office' }
];
let currentRoomIndex = 0;

// DOM Elements
const elTemp = document.getElementById('val-temp');
const elHumidity = document.getElementById('val-humidity');
const elPm25 = document.getElementById('val-pm25');
const elCo2 = document.getElementById('val-co2');
const elLogConsole = document.getElementById('log-console');

const devAirPurifier = document.getElementById('device-air-purifier');
const devAc = document.getElementById('device-ac');
const devFan = document.getElementById('device-fan');

// =======================================================
// KHỞI TẠO BIỂU ĐỒ REALTIME CHART.JS
// =======================================================
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

// =======================================================
// [TÁC VỤ 2] BẢN ĐỒ NHIỆT MÔI TRƯỜNG (HEATMAP DASHBOARD 2D)
// =======================================================
function updateHeatmap(currentRoom, data) {
    rooms.forEach(room => {
        const roomBox = document.getElementById(room.id);
        const aqiText = document.getElementById(room.aqiEl);

        if (room.id === currentRoom.id) {
            roomBox.classList.add('has-robot');
            
            // Đánh giá màu sắc Heatmap theo mức ô nhiễm
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

// =======================================================
// [TÁC VỤ 3] ĐIỀU KHIỂN THIẾT BỊ SMART HOME (MQTT/TUYA)
// =======================================================
function toggleDevice(element, turnOn) {
    const statusSpan = element.querySelector('.status-text');
    if (turnOn) {
        element.classList.add('active');
        statusSpan.textContent = 'ON (AUTO)';
    } else {
        element.classList.remove('active');
        statusSpan.textContent = 'OFF';
    }
}

function handleSmartHomeAutomation(data) {
    toggleDevice(devAirPurifier, data.pm25 > CONFIG.PM25_LIMIT_WARN);
    toggleDevice(devAc, data.temperature > CONFIG.TEMP_LIMIT_HIGH || data.humidity > CONFIG.HUMIDITY_LIMIT_HIGH);
    toggleDevice(devFan, data.co2 > CONFIG.CO2_LIMIT_WARN);
}

// =======================================================
// [TÁC VỤ 1] GỬI THÔNG BÁO TỰ ĐỘNG TELEGRAM / ZALO / EMAIL
// =======================================================
function triggerAlertNotifications(roomName, data) {
    if (data.pm25 > CONFIG.PM25_LIMIT_DANGER) {
        const currentTime = Date.now();
        if (currentTime - lastTelegramAlertTime > 8000) { // Giới hạn tần suất 8 giây
            lastTelegramAlertTime = currentTime;
            const msg = `📲 [TELEGRAM & ZALO BOT] ⚠️ CẢNH BÁO NGUY HIỂM tại [${roomName}]: PM2.5 = ${data.pm25}µg/m³, CO2 = ${data.co2}ppm. Đã bật Máy lọc không khí khẩn cấp!`;
            addLog(msg, 'telegram');
        }
    }
}

// =======================================================
// [TÁC VỤ 4] XUẤT BÁO CÁO DỮ LIỆU EXCEL / CSV / IN PDF
// =======================================================
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
    link.setAttribute("download", `Bao_Cao_Chat_Luong_Moi_Truong_AuraBot.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addLog("[SYSTEM] Đã xuất thành công file Báo cáo CSV/Excel chất lượng môi trường!", "info");
});

// =======================================================
// TRỢ LÝ GIỌNG NÓI TƯƠNG TÁC (AI VOICE CHATBOT)
// =======================================================
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

    let voiceMsg = `Robot đang ở ${currentRoom}. Nhiệt độ hiện tại là ${tempVal} độ, bụi mịn P M 2.5 là ${pm25Val}. `;
    if (parseFloat(pm25Val) > 50) {
        voiceMsg += `Chất lượng không khí chưa tốt, hệ thống đã bật máy lọc không khí tự động.`;
    } else {
        voiceMsg += `Chất lượng không khí trong phòng rất an toàn.`;
    }

    speakText(voiceMsg);
    addLog("[AI VOICE] Đã phát báo cáo giọng nói tiếng Việt.", "info");
});

// =======================================================
// LOG CONSOLE & SYSTEM LOOP
// =======================================================
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

    // Cập nhật giao diện thông số
    elTemp.textContent = sensorData.temperature;
    elHumidity.textContent = sensorData.humidity;
    elPm25.textContent = sensorData.pm25;
    elCo2.textContent = sensorData.co2;

    // Lưu dữ liệu để xuất Excel sau này
    envHistoryLogs.push({
        time: new Date().toLocaleTimeString(),
        room: currentRoom.name,
        temp: sensorData.temperature,
        humidity: sensorData.humidity,
        pm25: sensorData.pm25,
        co2: sensorData.co2
    });

    // Thực thi 4 Tác Vụ
    updateChart(sensorData);
    updateHeatmap(currentRoom, sensorData);
    handleSmartHomeAutomation(sensorData);
    triggerAlertNotifications(currentRoom.name, sensorData);

    addLog(`[SENSORS] Quét vị trí ${currentRoom.name}: PM2.5 = ${sensorData.pm25} µg/m³, CO2 = ${sensorData.co2} ppm.`, "info");

    // Robot chuyển vị trí phòng tiếp theo mỗi chu kỳ
    currentRoomIndex = (currentRoomIndex + 1) % rooms.length;
}

// Khởi chạy ứng dụng
window.onload = () => {
    initChart();
    runSystemLoop();
    setInterval(runSystemLoop, 3500); // 3.5 giây quét một lần
};