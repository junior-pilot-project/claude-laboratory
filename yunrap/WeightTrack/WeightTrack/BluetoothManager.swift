import CoreBluetooth
import Combine

class BluetoothManager: NSObject, ObservableObject {
    @Published var liveReading: WeightReading?
    @Published var stableReading: WeightReading?
    @Published var history: [WeightReading] = []
    @Published var isScanning = false
    @Published var bluetoothState: CBManagerState = .unknown

    private var centralManager: CBCentralManager!

    // Mi Smart Scale (XMTZC01HM/02HM) broadcasts weight via Weight Scale service (0x181D)
    private let scaleServiceUUID = CBUUID(string: "0000181D-0000-1000-8000-00805F9B34FB")

    override init() {
        super.init()
        centralManager = CBCentralManager(
            delegate: self,
            queue: DispatchQueue.global(qos: .userInitiated)
        )
    }

    func startScanning() {
        guard centralManager.state == .poweredOn else { return }
        centralManager.scanForPeripherals(
            withServices: [scaleServiceUUID],
            // allowDuplicates must be true to receive continuous live updates
            options: [CBCentralManagerScanOptionAllowDuplicatesKey: true]
        )
        DispatchQueue.main.async { self.isScanning = true }
    }

    func stopScanning() {
        centralManager.stopScan()
        DispatchQueue.main.async { self.isScanning = false }
    }

    func clearHistory() {
        DispatchQueue.main.async {
            self.history = []
            self.stableReading = nil
            self.liveReading = nil
        }
    }

    private func parseAdvertisement(_ data: Data) {
        // Mi Smart Scale v1 service data layout:
        //   byte[0]  : control flags
        //              bit 7 → weight removed (person stepped off)
        //              bit 5 → measurement stabilized (final value)
        //   byte[1-2]: raw weight, little-endian
        //              unit encoding: value / 200.0 = kg  (scale broadcasts in 0.5g steps / jin)
        guard data.count >= 3 else { return }

        let controlByte = data[0]
        let weightRemoved = (controlByte & 0x80) != 0

        if weightRemoved {
            DispatchQueue.main.async { self.liveReading = nil }
            return
        }

        let isStabilized = (controlByte & 0x20) != 0
        let rawWeight = UInt16(data[1]) | (UInt16(data[2]) << 8)
        let weightKg = Double(rawWeight) / 200.0

        // Sanity check: ignore implausible values
        guard weightKg > 5.0 && weightKg < 300.0 else { return }

        let reading = WeightReading(
            weight: weightKg,
            isStabilized: isStabilized,
            timestamp: Date()
        )

        DispatchQueue.main.async {
            self.liveReading = reading
            if isStabilized {
                self.stableReading = reading
                self.history.insert(reading, at: 0)
                if self.history.count > 20 {
                    self.history = Array(self.history.prefix(20))
                }
            }
        }
    }
}

extension BluetoothManager: CBCentralManagerDelegate {
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        DispatchQueue.main.async { self.bluetoothState = central.state }
        if central.state == .poweredOn {
            startScanning()
        }
    }

    func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        guard
            let serviceData = advertisementData[CBAdvertisementDataServiceDataKey] as? [CBUUID: Data],
            let data = serviceData[scaleServiceUUID]
        else { return }

        parseAdvertisement(data)
    }
}
