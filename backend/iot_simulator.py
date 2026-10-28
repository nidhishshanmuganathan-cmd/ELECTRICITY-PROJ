"""Minimal authenticated WattWatcher meter simulator.

Example:
    python iot_simulator.py --device-id <uuid> --token <provisioned-token>
"""

import argparse
import json
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def send_reading(base_url: str, device_id: str, token: str, energy: float, recorded_at: datetime):
    payload = json.dumps({
        "voltage": 230.0,
        "current": round((energy * 4000) / 230, 3),
        "power": round(energy * 4000, 2),
        "energy": energy,
        "frequency": 50.0,
        "power_factor": 0.95,
        "recorded_at": recorded_at.isoformat(),
    }).encode("utf-8")
    request = Request(
        f"{base_url.rstrip('/')}/devices/{device_id}/readings/",
        data=payload,
        headers={"Content-Type": "application/json", "X-Device-Token": token},
        method="POST",
    )
    with urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def main():
    parser = argparse.ArgumentParser(description="Send authenticated WattWatcher meter readings.")
    parser.add_argument("--device-id", required=True)
    parser.add_argument("--token", required=True, help="Token returned by POST /devices/{id}/provision-token")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--count", type=int, default=1)
    parser.add_argument("--energy", type=float, default=0.1, help="kWh per reading")
    args = parser.parse_args()

    if args.count < 1 or args.energy < 0:
        parser.error("--count must be positive and --energy cannot be negative")

    now = datetime.now(timezone.utc)
    try:
        for index in range(args.count):
            reading = send_reading(
                args.base_url,
                args.device_id,
                args.token,
                args.energy,
                now + timedelta(minutes=15 * index),
            )
            print(f"Uploaded reading {index + 1}/{args.count}: {reading['id']}")
    except HTTPError as error:
        print(f"Upload failed ({error.code}): {error.read().decode('utf-8')}")
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
