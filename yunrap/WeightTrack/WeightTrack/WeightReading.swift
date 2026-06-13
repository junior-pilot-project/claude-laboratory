import Foundation

struct WeightReading: Identifiable, Equatable, Codable {
    let id: UUID
    let weight: Double
    let isStabilized: Bool
    let timestamp: Date

    init(weight: Double, isStabilized: Bool, timestamp: Date) {
        self.id = UUID()
        self.weight = weight
        self.isStabilized = isStabilized
        self.timestamp = timestamp
    }

    var formattedWeight: String {
        String(format: "%.1f", weight)
    }

    var formattedTime: String {
        let formatter = DateFormatter()
        formatter.timeStyle = .medium
        return formatter.string(from: timestamp)
    }
}
