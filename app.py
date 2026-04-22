from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3

app = Flask(__name__, static_folder='.', template_folder='.')
CORS(app)

DATABASE = 'rsvp.db'

def get_db():
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    return db

def init_db():
    with app.app_context():
        db = get_db()
        db.execute('''
            CREATE TABLE IF NOT EXISTS rsvps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                name TEXT NOT NULL,
                attendance TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                has_guests TEXT DEFAULT 'No',
                guest_count INTEGER DEFAULT 0,
                guest_details TEXT,
                dietary_requirements TEXT,
                message TEXT
            )
        ''')
        db.commit()

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/rsvp', methods=['POST'])
def submit_rsvp():
    try:
        data = request.get_json()
        guest_details = ''
        if data.get('guests') and len(data['guests']) > 0:
            guest_details = '; '.join([
                "{}. {} ({})".format(i+1, g['name'], g['relationship'])
                for i, g in enumerate(data['guests'])
            ])

        db = get_db()
        cursor = db.execute('''
            INSERT INTO rsvps (name, attendance, email, phone, has_guests, guest_count, guest_details, dietary_requirements, message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['name'], data['attendance'], data['email'], data['phone'],
            data['hasGuests'], data['guestCount'], guest_details,
            data['dietary'], data['message']
        ))
        db.commit()
        rsvp_id = cursor.lastrowid
        return jsonify({'success': True, 'message': 'RSVP received successfully', 'id': rsvp_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/rsvps', methods=['GET'])
def get_rsvps():
    try:
        db = get_db()
        rsvps = db.execute('SELECT * FROM rsvps ORDER BY timestamp DESC').fetchall()
        return jsonify({'success': True, 'rsvps': [dict(rsvp) for rsvp in rsvps]})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    init_db()
    print("Wedding RSVP server starting...")
    print("Website: http://localhost:5000")
    print("View RSVPs: http://localhost:5000/api/rsvps")
    app.run(debug=True, port=5000)