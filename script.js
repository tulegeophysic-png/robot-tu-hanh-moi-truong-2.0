let robotBattery = 100;
let isCharging = false;

// Khởi tạo Biểu đồ Chart.js
const ctx = document.getElementById('envChart').getContext('2d');
const envChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            { label: 'Nhiệt độ (°C)', borderColor: '#f97316', data: [], tension: 0.3 },
            { label: 'Độ ẩm (%)', borderColor: '#06b6d4', data: [], tension: 0.3 },
            { label: 'PM2.5 (µg/m³)', borderColor: '#a855f7', data: [], tension: 0.3 }
        ]
    },
    options: {
        responsive: true,
        scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
        },
        plugins: {
            legend: { labels: { color: '#f8fafc' } }
        }
    }
});

function addLog(message, type = 'info') {
    const logBox = document.getElementById('system-logs');
    const logItem = document.createElement('div');
    const timeStr = new Date().toLocaleTimeString();
    
    logItem.className = `log-item ${type}`;
    logItem.textContent = `[${timeStr}] ${message}`;
    logBox.prepend(logItem);
}

// -------------------------------------------------------------
// NÚT BẬT/TẮT SẠC THỦ CÔNG & RESET PIN
// -------------------------------------------------------------
function toggleCharging() {
    isCharging = !isCharging;
    const btn = document.getElementById('btn-toggle-charge');
    const btnText = document.getElementById('btn-charge-text');
    const robotStateText = document.getElementById('robot-state-text');

    if (isCharging) {
        btn.classList.add('active');
        btnText.textContent = "Dừng Sạc & Rời Dock";
        robotStateText.textContent = "🔋 ĐANG SẠC PIN (THỦ CÔNG)";
        robotStateText.style.color = "#eab308";
        addLog("⚡ [MANUAL] Người dùng đã BẬT lệnh cho Robot về trạm sạc thủ công.", "warn");
    } else {
        btn.classList.remove('active');
        btnText.textContent = "Cho Robot Đi Sạc (Thủ Công)";
        robotStateText.textContent = "Đang đo & quét";
        robotStateText.style.color = "#38bdf8";
        addLog("🟢 [MANUAL] Người dùng đã TẮT chế độ sạc. Robot tiếp tục di chuyển quét môi trường.", "info");
    }
}

function resetBattery() {
    robotBattery = 100;
    document.getElementById('val-battery').textContent = "100";
    addLog("🔋 [MANUAL] Đã đặt lại dung lượng Pin về 100%.", "info");
}

// Giả lập đọc cảm biến
function readSensors() {
    if (isCharging) {
        robotBattery += 15;
        if (robotBattery >= 100) {
            robotBattery = 100;
            isCharging = false;
            updateChargeButtonUI(false);
            addLog("🟢 Pin đầy (100%). Robot tự động hoàn thành chu kỳ sạc!", "info");
        }
    } else {
        robotBattery -= Math.floor(Math.random() * 5) + 3;
    }

    return {
        battery: Math.max(0, robotBattery),
        temperature: parseFloat((Math.random() * (36 - 24) + 24).toFixed(1)),
        humidity: parseFloat((Math.random() * (80 - 45) + 45).toFixed(1)),
        pm25: parseFloat((Math.random() * (120 - 15) + 15).toFixed(1)),
        co2: parseFloat((Math.random() * (1400 - 400) + 400).toFixed(0))
    };
}

function updateChargeButtonUI(chargingState) {
    const btn = document.getElementById('btn-toggle-charge');
    const btnText = document.getElementById('btn-charge-text');
    if (chargingState) {
        btn.classList.add('active');
        btnText.textContent = "Dừng Sạc & Rời Dock";
    } else {
        btn.classList.remove('active');
        btnText.textContent = "Cho Robot Đi Sạc (Thủ Công)";
    }
}

// Kiểm tra Pin tự động (< 20%)
function handleBatteryCheck(batteryVal) {
    const batCard = document.getElementById('card-battery');
    const batText = document.getElementById('val-battery');
    const robotStateText = document.getElementById('robot-state-text');
    
    batText.textContent = batteryVal;

    if (batteryVal < 20 && !isCharging) {
        batCard.classList.add('battery-low');
        robotStateText.textContent = "🔋 ĐANG VỀ DOCK SẠC (<20%)";
        robotStateText.style.color = "#ef4444";

        addLog(`⚡ CẢNH BÁO: Pin còn ${batteryVal}% (< 20%). Tự động kích hoạt sạc!`, "danger");
        
        isCharging = true;
        updateChargeButtonUI(true);
    } else if (batteryVal >= 20 && !isCharging) {
        batCard.classList.remove('battery-low');
        robotStateText.textContent = "Đang đo & quét";
        robotStateText.style.color = "#38bdf8";
    }
}

// Luồng thực thi chính
function runSystemLoop() {
    const data = readSensors();

    document.getElementById('val-temp').textContent = data.temperature;
    document.getElementById('val-humidity').textContent = data.humidity;
    document.getElementById('val-pm25').textContent = data.pm25;
    document.getElementById('val-co2').textContent = data.co2;

    handleBatteryCheck(data.battery);

    if (!isCharging) {
        const now = new Date().toLocaleTimeString();
        if (envChart.data.labels.length > 7) {
            envChart.data.labels.shift();
            envChart.data.datasets.forEach(ds => ds.data.shift());
        }
        envChart.data.labels.push(now);
        envChart.data.datasets[0].data.push(data.temperature);
        envChart.data.datasets[1].data.push(data.humidity);
        envChart.data.datasets[2].data.push(data.pm25);
        envChart.update();

        addLog(`[SENSORS] Pin: ${data.battery}% | Temp: ${data.temperature}°C | PM2.5: ${data.pm25}`, "info");
    } else {
        addLog(`[CHARGING] Đang trong trạm sạc... Dung lượng hiện tại: ${data.battery}%`, "warn");
    }
}

setInterval(runSystemLoop, 3000);
runSystemLoop();