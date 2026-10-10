"""
4clique Local AWS Lambda Runner
Runs the exact lambda_function.py handler locally via Python's built-in HTTP server.
Enables instant zero-friction local testing, CORS testing, and DevTools inspection.
"""

import sys
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
import json

# Add lambda dir to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lambda_function import lambda_handler

def load_env():
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_file = os.path.join(parent_dir, ".env")
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k, v = k.strip(), v.strip().strip('"').strip("'")
                    os.environ[k] = v

load_env()

PORT = int(os.environ.get("LAMBDA_LOCAL_PORT", 8000))


class LambdaLocalHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Clean terminal logging
        sys.stderr.write(f"[Local Lambda URL] {self.command} {self.path} - {format % args}\n")

    def do_OPTIONS(self):
        event = {
            "httpMethod": "OPTIONS",
            "requestContext": {"http": {"method": "OPTIONS"}},
            "path": self.path,
            "headers": dict(self.headers),
            "body": ""
        }
        response = lambda_handler(event, None)
        self.send_response(response["statusCode"])
        for k, v in response.get("headers", {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(response.get("body", "").encode("utf-8"))

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else ""

        event = {
            "httpMethod": "POST",
            "requestContext": {"http": {"method": "POST"}},
            "path": self.path,
            "headers": dict(self.headers),
            "body": body
        }

        response = lambda_handler(event, None)
        self.send_response(response["statusCode"])
        for k, v in response.get("headers", {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(response.get("body", "").encode("utf-8"))

    def do_GET(self):
        # Healthcheck endpoint
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({
            "service": "4clique-hydrologic-twin",
            "status": "ready",
            "environment": "local-lambda-runner",
            "instructions": "Send HTTP POST to / with project payload"
        }).encode("utf-8"))


def run():
    server_address = ("127.0.0.1", PORT)
    httpd = HTTPServer(server_address, LambdaLocalHandler)
    print(f"\n========================================================")
    print(f"4CLIQUE LOCAL AWS LAMBDA RUNNER ACTIVE")
    print(f"Listening on: http://127.0.0.1:{PORT}")
    print(f"CORS Enabled: Access-Control-Allow-Origin: *")
    print(f"Target Zone: Bellandur-ORR, Bengaluru")
    print(f"Ready to process simulation POST requests...")
    print(f"========================================================\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down local Lambda server.")
        httpd.server_close()


if __name__ == "__main__":
    run()
