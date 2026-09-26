/**
 * Human-readable names for detection classes.
 *
 * Only the classes whose raw value reads poorly are listed; everything else is
 * title-cased from the value itself so a new class appears without a change
 * here. Client-safe: no server imports.
 */
const detectionTypeLabels: Record<string, string> = {
    with_helmet: "With Helmet",
    without_helmet: "Without Helmet",
    DHelmet: "Helmet (Detector)",
    DNoHelmet: "No Helmet (Detector)",
    "rider-with-helmet": "Rider With Helmet",
    "rider-with-nohelmet": "Rider Without Helmet",
    license_plate: "Licence Plate",
    "license-plate": "License Plate",
    plate: "Plate",
    lane_line: "Lane Line",
    lane_weave: "Lane Weaving",
    ego_lane_change: "Lane Change",
    rashdriving_lane_weave: "Rash Driving / Weaving",
    wrong_way: "Wrong Way",
    sudden_accel: "Sudden Acceleration",
    sudden_brake: "Sudden Brake",
    sharp_turn: "Sharp Turn",
    vehicle: "Vehicle",
};

export function formatDetectionTypeLabel(type?: string | null): string {
    if (!type) return "Traffic Violation";
    if (detectionTypeLabels[type]) return detectionTypeLabels[type];
    return type
        .replace(/[_-]+/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}
