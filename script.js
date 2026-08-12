// TRẠNG THÁI HỆ THỐNG
let isRobotPowerOn = true;        // Nút Bật/Tắt nguồn thủ công
let isManualCharging = false;     // Nút Bật/Tắt sạc thủ công
let isAutoCharging = false;       // Trạng thái sạc tự động (Auto-docking)
let robotBattery = 100;
let emergencyActive = false;

// Khởi tạo Biểu đồ Chart.js
const ctx = document.getElementById('envChart').getContext('2d');
const envChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            { label: 'Nhiệt độ (°C)', borderColor: '#f97316', data: [], tension: 0.3 },
            { label: 'Khí Gas/Khói (PPM)', borderColor: '#eab308', data: [], tension: 0.3 },
            { label: 'PM2.5 (µg/m³)', borderColor: '#a855f7', data: [], tension: 0.3 }
        ]
    },
    options: {
        responsive: true,
        scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
        },
        plugins: { legend: { labels: { color: '#f8fafc' } } }
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
// TÁC VỤ 1: CÔNG TẮC BẬT/TẮT ROBOT VÀ BẬT/TẮT SẠC THỦ CÔNG
// -------------------------------------------------------------
function toggleRobotPower(checkbox) {
    isRobotPowerOn = checkbox.checked;
    const label = document.getElementById('power-status-label');
    const robotStateText = document.getElementById('robot-state-text');

    if (isRobotPowerOn) {
        label.textContent = "ON (Hoạt động)";
        label.className = "status-label active";
        robotStateText.textContent = "Đang đo & quét";
        robotStateText.style.color = "#38bdf8";
        addLog("🟢 [POWER] Robot đã được BẬT nguồn thủ công.", "info");
    } else {
        label.textContent = "OFF (Tắt nguồn)";
        label.className = "status-label off";
        robotStateText.textContent = "Đã Tắt (Off)";
        robotStateText.style.color = "#ef4444";
        addLog("🔴 [POWER] Robot đã bị TẮT nguồn thủ công bởi người dùng.", "warn");
    }
}

function toggleManualCharging() {
    if (!isRobotPowerOn) {
        alert("Vui lòng BẬT nguồn Robot trước!");
        return;
    }
    isManualCharging = !isManualCharging;
    updateChargingUI();
}

function updateChargingUI() {
    const btn = document.getElementById('btn-manual-charge');
    const btnText = document.getElementById('btn-charge-text');
    const robotStateText = document.getElementById('robot-state-text');

    if (isManualCharging || isAutoCharging) {
        btn.classList.add('active');
        btnText.textContent = "Dừng Sạc & Rời Dock";
        robotStateText.textContent = "🔋 ĐANG Ở TRẠM SẠC";
        robotStateText.style.color = "#eab308";
    } else {
        btn.classList.remove('active');
        btnText.textContent = "Gọi Robot Về Sạc";
        robotStateText.textContent = "Đang đo & quét";
        robotStateText.style.color = "#38bdf8";
    }
}

function resetBattery() {
    robotBattery = 100;
    document.getElementById('val-battery').textContent = "100";
    addLog("🔋 [PIN] Đã đặt lại dung lượng Pin thủ công về 100%.", "info");
}

// -------------------------------------------------------------
// TÁC VỤ 2: TỰ ĐỘNG QUẢN LÝ PIN & AUTO-DOCKING
// -------------------------------------------------------------
function processBatteryLogic() {
    const batCard = document.getElementById('card-battery');
    const batSub = document.getElementById('battery-status-sub');
    
    // Nếu đang sạc (Thủ công hoặc Tự động)
    if (isManualCharging || isAutoCharging) {
        robotBattery += 10;
        batSub.textContent = "Trạng thái: Đang sạc⚡";
        
        if (robotBattery >= 100) {
            robotBattery = 100;
            isAutoCharging = false;
            isManualCharging = false;
            updateChargingUI();
            addLog("🟢 [AUTO-DOCKING] Pin đã đầy 100%. Robot tự rời Dock tiếp tục nhiệm vụ!", "info");
        }
    } else if (isRobotPowerOn) {
        // Tiêu thụ pin khi hoạt động
        robotBattery -= Math.floor(Math.random() * 4) + 2;
        if (robotBattery < 0) robotBattery = 0;
        batSub.textContent = "Trạng thái: Đang xả pin";
    }

    document.getElementById('val-battery').textContent = robotBattery;

    // Phân cấp Cảnh báo Pin
    if (robotBattery <= 15 && !isAutoCharging && !isManualCharging && isRobotPowerOn) {
        batCard.className = "metric-card battery-critical";
        isAutoCharging = true; // KÍCH HOẠT AUTO-DOCKING
        updateChargingUI();
        addLog(`🚨 [AUTO-DOCKING] Pin nguy kịch (${robotBattery}% < 15%)! Robot tự động về Trạm Sạc khẩn cấp!`, "danger");
    } else if (robotBattery <= 30 && robotBattery > 15) {
        batCard.className = "metric-card battery-low";
    } else if (robotBattery > 30) {
        batCard.className = "metric-card";
    }
}

// -------------------------------------------------------------
// TÁC VỤ 3: CẢNH BÁO KHẨN CẤP KHÍ GAS & CHÁY (GAS & FIRE ALARM)
// -------------------------------------------------------------
function processGasAndFireSafety(gasVal, tempVal) {
    const gasCard = document.getElementById('card-gas');
    const gasSub = document.getElementById('gas-status-sub');
    const banner = document.getElementById('emergency-banner');
    const emergencyText = document.getElementById('emergency-text');

    // Mức ngưỡng nguy hiểm: Khí Gas > 400 PPM hoặc Nhiệt độ > 50°C
    const isGasEmergency = gasVal > 400;
    const isFireEmergency = tempVal > 50.0;

    if ((isGasEmergency || isFireEmergency) && !emergencyActive) {
        emergencyActive = true;
        gasCard.classList.add('emergency-alarm');
        banner.classList.remove('hidden');

        let cause = isGasEmergency ? `RÒ RỈ KHÍ GAS (Đạt ${gasVal} PPM)` : `NGUY CƠ CHÁY (Nhiệt độ ${tempVal}°C)`;
        emergencyText.textContent = `🚨 CẢNH BÁO KHẨN CẤP: PHÁT HIỆN ${cause}!`;
        gasSub.textContent = "⚠️ NGUY HIỂM!";
        gasSub.className = "text-danger";

        addLog(`🚨🚨 [CẢNH BÁO BÁO CHÁY/GAS] Phát hiện nguy hiểm: ${cause}. Kích hoạt còi hú & phát thông báo!`, "danger");
    } else if (!isGasEmergency && !isFireEmergency && emergencyActive) {
        // Tự động ngắt khi môi trường an toàn trở lại
        dismissEmergency();
    }
}

function dismissEmergency() {
    emergencyActive = false;
    document.getElementById('emergency-banner').classList.add('hidden');
    document.getElementById('card-gas').classList.remove('emergency-alarm');
    document.getElementById('gas-status-sub').textContent = "An Toàn";
    document.getElementById('gas-status-sub').className = "text-safe";
    addLog("🟢 [AN TOÀN] Cảnh báo Gas/Cháy đã được tắt hoặc môi trường đã an toàn trở lại.", "info");
}

// -------------------------------------------------------------
// LUỒNG CHÍNH ĐỒNG BỘ MÔ PHỎNG SENSOR
// -------------------------------------------------------------
function runSystemLoop() {
    if (!isRobotPowerOn) return; // Nếu Robot tắt nguồn -> Dừng cập nhật dữ liệu

    // Giả lập đọc dữ liệu từ phần cứng
    const tempVal = parseFloat((Math.random() * (35 - 25) + 25).toFixed(1));
    const humidityVal = parseFloat((Math.random() * (80 - 45) + 45).toFixed(1));
    const pm25Val = parseFloat((Math.random() * (100 - 15) + 15).toFixed(1));
    const co2Val = parseFloat((Math.random() * (1200 - 400) + 400).toFixed(0));
    
    // Thỉnh thoảng tạo biến động ngẫu nhiên để test Cảnh báo Gas/Cháy (Tác vụ 3)
    let gasVal = Math.floor(Math.random() * 200) + 80;
    if (Math.random() < 0.1) gasVal = Math.floor(Math.random() * 300) + 420; // Giả lập rò rỉ Gas

    // Cập nhật DOM
    document.getElementById('val-temp').textContent = tempVal;
    document.getElementById('val-humidity').textContent = humidityVal;
    document.getElementById('val-pm25').textContent = pm25Val;
    document.getElementById('val-co2').textContent = co2Val;
    document.getElementById('val-gas').textContent = gasVal;

    // Thực thi xử lý Tác vụ 2 & Tác vụ 3
    processBatteryLogic();
    processGasAndFireSafety(gasVal, tempVal);

    // Cập nhật biểu đồ khi không sạc
    if (!isManualCharging && !isAutoCharging) {
        const now = new Date().toLocaleTimeString();
        if (envChart.data.labels.length > 7) {
            envChart.data.labels.shift();
            envChart.data.datasets.forEach(ds => ds.data.shift());
        }
        envChart.data.labels.push(now);
        envChart.data.datasets[0].data.push(tempVal);
        envChart.data.datasets[1].data.push(gasVal);
        envChart.data.datasets[2].data.push(pm25Val);
        envChart.update();
    }
}

setInterval(runSystemLoop, 3000);
runSystemLoop();