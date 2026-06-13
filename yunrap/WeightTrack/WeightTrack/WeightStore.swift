import Foundation

class WeightStore {
    private let key = "weight_history"

    func save(_ readings: [WeightReading]) {
        guard let data = try? JSONEncoder().encode(readings) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    func load() -> [WeightReading] {
        guard
            let data = UserDefaults.standard.data(forKey: key),
            let readings = try? JSONDecoder().decode([WeightReading].self, from: data)
        else { return [] }
        return readings
    }

    // Group readings by month → [(yearMonth, [readings])]
    func groupedByMonth(_ readings: [WeightReading]) -> [(key: String, readings: [WeightReading])] {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy년 M월"
        formatter.locale = Locale(identifier: "ko_KR")

        var dict: [String: [WeightReading]] = [:]
        for r in readings {
            let key = formatter.string(from: r.timestamp)
            dict[key, default: []].append(r)
        }

        return dict
            .map { (key: $0.key, readings: $0.value.sorted { $0.timestamp > $1.timestamp }) }
            .sorted { lhs, rhs in
                let lhsDate = lhs.readings.first?.timestamp ?? .distantPast
                let rhsDate = rhs.readings.first?.timestamp ?? .distantPast
                return lhsDate > rhsDate
            }
    }
}
