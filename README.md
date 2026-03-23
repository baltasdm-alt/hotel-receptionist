# 🏨 Villa Eleni Hotel — AI Receptionist Backend

A production-ready MVP for an AI-powered phone receptionist for a 4-star hotel in Greece. Built with Node.js, Express, and the Anthropic Claude API with tool calling.

---

## Features

- **Bilingual**: Responds in Greek or English based on the guest's language
- **Tool calling**: Checks availability, retrieves room types, applies policies — never invents data
- **Booking flow**: Guides guests through check-in/out, guests, room selection, and reservation request
- **Human handoff**: Transfers complex or sensitive requests to hotel staff
- **Session memory**: Maintains conversation history per session
- **Voice-ready**: `/voice` endpoint designed for Twilio/Vonage integration

---

## Project Structure

```
hotel-receptionist/
├── index.js                   # Express app entry point
├── package.json
├── .env.example
├── routes/
│   └── index.js               # GET /health, POST /test-chat, POST /voice
├── services/
│   ├── claude.js              # Anthropic API client + agentic tool loop
│   └── hotelTools.js          # Tool definitions + implementations
├── prompts/
│   └── systemPrompt.txt       # Hotel AI persona and instructions
└── data/
    ├── hotelInfo.json          # Hotel details, facilities, FAQ
    ├── rooms.json              # Room types, pricing, mock availability
    └── policies.json           # Cancellation, payment, pets, smoking, etc.
```

---

## Setup

### 1. Clone and install

```bash
git clone <your-repo>
cd hotel-receptionist
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### 3. Start the server

```bash
# Production
npm start

# Development (auto-reload)
npm run dev
```

Server starts on `http://localhost:3000`

---

## API Reference

### `GET /health`

Health check — confirms server is running and API key is set.

```bash
curl http://localhost:3000/health
```

```json
{
  "status": "ok",
  "service": "Villa Eleni Hotel AI Receptionist",
  "anthropicApiKey": "configured"
}
```

---

### `POST /test-chat`

Text-based chat interface for testing. Maintains session history.

**Request:**
```json
{
  "message": "Hi, I'd like to book a room for 2 adults in July",
  "sessionId": "test-session-001"
}
```

**Response:**
```json
{
  "reply": "Welcome to Villa Eleni! I'd be happy to help. What date are you planning to check in?",
  "sessionId": "test-session-001",
  "toolsUsed": [],
  "history": 2
}
```

**Tip:** Reuse the same `sessionId` to continue the conversation. Omit it to start a new session.

---

### `POST /voice`

Webhook-ready endpoint for phone providers (Twilio, Vonage). Accepts speech-to-text input.

**Request:**
```json
{
  "transcript": "Γεια σας, θέλω να κάνω κράτηση",
  "callSid": "CA123abc",
  "from": "+306912345678"
}
```

**Response:**
```json
{
  "reply": "Καλημέρα! Χαίρομαι που επικοινωνήσατε με το Villa Eleni. Για ποιες ημερομηνίες επιθυμείτε να κάνετε κράτηση;",
  "callSid": "CA123abc",
  "shouldHandoff": false,
  "toolsUsed": []
}
```

Use `shouldHandoff: true` in your phone system to trigger a live transfer.

---

### `DELETE /test-chat/:sessionId`

Clear a session's conversation history.

```bash
curl -X DELETE http://localhost:3000/test-chat/test-session-001
```

---

## Tools

| Tool | Description |
|------|-------------|
| `checkAvailability` | Checks room availability for dates + guest count |
| `getRoomTypes` | Returns room details, amenities, and pricing |
| `getHotelPolicies` | Retrieves cancellation, payment, pet, and other policies |
| `createReservationRequest` | Creates a pending reservation (not a confirmed booking) |
| `handoffToHuman` | Initiates transfer to hotel staff |

---

## Testing the Booking Flow

Here is a sample conversation to test end-to-end:

```bash
# Start conversation
curl -X POST http://localhost:3000/test-chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, I want to book a room", "sessionId": "test1"}'

# Provide dates
curl -X POST http://localhost:3000/test-chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Check-in August 10th, check-out August 17th", "sessionId": "test1"}'

# Provide guests
curl -X POST http://localhost:3000/test-chat \
  -H "Content-Type: application/json" \
  -d '{"message": "2 adults and 2 children aged 5 and 8", "sessionId": "test1"}'

# Select room
curl -X POST http://localhost:3000/test-chat \
  -H "Content-Type: application/json" \
  -d '{"message": "The family sea view room please", "sessionId": "test1"}'

# Provide contact
curl -X POST http://localhost:3000/test-chat \
  -H "Content-Type: application/json" \
  -d '{"message": "My name is Maria Papadaki, phone +30 6912345678, email maria@example.com", "sessionId": "test1"}'
```

---

## Connecting to a Phone System

### Twilio (example)

1. Create a Twilio phone number
2. Set the webhook URL to `https://your-server.com/voice`
3. Use a speech recognition middleware (e.g. Twilio Media Streams + Deepgram) to pass transcripts
4. Use Twilio TTS to speak the reply back
5. If `shouldHandoff: true`, use `<Dial>` to transfer the call

### Session Management in Production

The current in-memory session store resets on restart. For production:
- Use **Redis** with `express-session` and `connect-redis`
- Or store conversation history in a database per `callSid` / `sessionId`

---

## Customisation

- **Hotel data**: Edit `data/hotelInfo.json`, `data/rooms.json`, `data/policies.json`
- **AI persona**: Edit `prompts/systemPrompt.txt`
- **Pricing logic**: Modify `getSeason()` in `services/hotelTools.js`
- **Real availability**: Replace mock logic in `checkAvailability()` with your PMS API call
- **Notifications**: In `createReservationRequest()`, add email/Slack/webhook notifications

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ Yes | Your Anthropic API key |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | `development` or `production` |

---

## License

MIT — free to use and modify for your hotel project.
