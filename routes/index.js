const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// UTF-8
router.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// In-memory sessions
const sessions = new Map();

// Load hotel knowledge
const hotelInfo = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/hotelInfo.json'), 'utf8')
);

const roomsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/rooms.json'), 'utf8')
);

const policiesData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/policies.json'), 'utf8')
);

// Build hotel context for Claude
const hotelContext = `
HOTEL INFO
Name: ${hotelInfo.name}
Stars: ${hotelInfo.stars}
Tagline: ${hotelInfo.tagline}

Location:
- Address: ${hotelInfo.location.address}
- Region: ${hotelInfo.location.region}
- Nearest Airport: ${hotelInfo.location.nearestAirport}
- Distance from airport: ${hotelInfo.location.distanceFromAirport}
- Distance from beach: ${hotelInfo.location.distanceFromBeach}

Contact:
- Phone: ${hotelInfo.contact.phone}
- Email: ${hotelInfo.contact.email}
- Website: ${hotelInfo.contact.website}

Check-in / Check-out:
- Check-in: ${hotelInfo.checkInTime}
- Check-out: ${hotelInfo.checkOutTime}
- Reception: ${hotelInfo.reception}

Languages:
- ${hotelInfo.languages.join(', ')}

Breakfast:
- Type: ${hotelInfo.breakfast.type}
- Included: ${hotelInfo.breakfast.included}
- Hours: ${hotelInfo.breakfast.hours}
- Location: ${hotelInfo.breakfast.location}
- Description: ${hotelInfo.breakfast.description}

Facilities:
- Pool: ${hotelInfo.facilities.pool.description}
- Pool hours: ${hotelInfo.facilities.pool.hours}
- Beach: ${hotelInfo.facilities.beach.description}
- Restaurant: ${hotelInfo.facilities.restaurant.name}, ${hotelInfo.facilities.restaurant.hours}
- Bar: ${hotelInfo.facilities.bar.name}, ${hotelInfo.facilities.bar.hours}
- Spa: ${hotelInfo.facilities.spa.available ? 'Yes' : 'No'}, ${hotelInfo.facilities.spa.hours}
- Fitness: ${hotelInfo.facilities.fitness.available ? 'Yes' : 'No'}, ${hotelInfo.facilities.fitness.hours}
- Kids Club: ${hotelInfo.facilities.kidsClub.available ? 'Yes' : 'No'}, ${hotelInfo.facilities.kidsClub.hours}
- Parking: ${hotelInfo.facilities.parking.type}
- Wifi: ${hotelInfo.facilities.wifi.cost}
- Room service: ${hotelInfo.facilities.roomService.hours}

Transfers:
- Airport transfer available: ${hotelInfo.transfers.airportTransfer.available ? 'Yes' : 'No'}
- Transfer price: ${hotelInfo.transfers.airportTransfer.price}
- Transfer booking rule: ${hotelInfo.transfers.airportTransfer.booking}

Pets:
- Allowed: ${hotelInfo.pets.allowed ? 'Yes' : 'No'}
- Note: ${hotelInfo.pets.note}

Smoking:
- Policy: ${hotelInfo.smoking.policy}
- Smoking area: ${hotelInfo.smoking.smokingArea}

Family-friendly:
- Baby equipment: ${hotelInfo.familyFriendly.babyEquipment.join(', ')}
- Kids menu: ${hotelInfo.familyFriendly.kidsMenu ? 'Yes' : 'No'}
- Babysitting: ${hotelInfo.familyFriendly.babysitting.note}

ROOM TYPES
${roomsData.rooms.map(room => `
ID: ${room.id}
Type: ${room.type}
Category: ${room.category}
Size: ${room.sizeSqm} sqm
Max Adults: ${room.maxAdults}
Max Children: ${room.maxChildren}
Max Occupancy: ${room.maxOccupancy}
View: ${room.view}
Beds: ${room.bedOptions.join(', ')}
Breakfast Included: ${room.breakfastIncluded ? 'Yes' : 'No'}
Suitable For: ${room.suitableFor.join(', ')}
Description: ${room.description}
Pricing:
- Low season: €${room.basePrice.lowSeason}
- Mid season: €${room.basePrice.midSeason}
- High season: €${room.basePrice.highSeason}
Amenities: ${room.amenities.join(', ')}
`).join('\n')}

SEASONS
- Low: ${roomsData.seasons.low.description}
- Mid: ${roomsData.seasons.mid.description}
- High: ${roomsData.seasons.high.description}

ADDITIONAL FEES
- Extra bed: €${roomsData.additionalFees.extraBed}
- Baby cot: €${roomsData.additionalFees.cotBaby}
- Early check-in: €${roomsData.additionalFees.earlyCheckin}
- Late checkout: €${roomsData.additionalFees.lateCheckout}
- City tax per person per night: €${roomsData.additionalFees.cityTaxPerPersonPerNight}

POLICIES
Cancellation:
- Standard: ${policiesData.cancellation.standard.policy}
- Standard late cancellation: ${policiesData.cancellation.standard.lateCancellation}
- No-show: ${policiesData.cancellation.standard.noShow}
- Non-refundable: ${policiesData.cancellation.nonRefundable.policy}
- High season: ${policiesData.cancellation.highSeason.policy}
- High season late cancellation: ${policiesData.cancellation.highSeason.lateCancellation}

Payment:
- Methods: ${policiesData.payment.acceptedMethods.join(', ')}
- Deposit policy: ${policiesData.payment.depositPolicy}
- Payment at check-in: ${policiesData.payment.paymentAtCheckIn}

Check-in:
- Time: ${policiesData.checkIn.time}
- Early possible: ${policiesData.checkIn.earliestPossible}
- Early fee: ${policiesData.checkIn.earlyCheckinFee}
- ID required: ${policiesData.checkIn.idRequired}
- Minimum age: ${policiesData.checkIn.minAge}

Check-out:
- Time: ${policiesData.checkOut.time}
- Latest possible: ${policiesData.checkOut.latestPossible}
- Late fee: ${policiesData.checkOut.lateCheckoutFee}

Children:
- Free stay: ${policiesData.children.freeStay}
- Reduced rate: ${policiesData.children.reducedRate}
- Teenagers/adults: ${policiesData.children.teenagersAdults}
- Cots: ${policiesData.children.cots}
- Kids club: ${policiesData.children.kidsClub}

Disability:
- Accessible: ${policiesData.disability.accessible ? 'Yes' : 'No'}
- Features: ${policiesData.disability.features.join(', ')}
- Note: ${policiesData.disability.note}

Groups:
- Definition: ${policiesData.groups.definition}
- Policy: ${policiesData.groups.policy}
- Contact: ${policiesData.groups.contact}
`;

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Villa Eleni Hotel AI Receptionist'
  });
});

// AI chat with session memory
router.post('/test-chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body || {};

    if (!message || !message.trim()) {
      return res.status(400).json({
        reply: 'Δεν έλαβα μήνυμα.',
        sessionId: sessionId || null
      });
    }

    const sid = sessionId || `session-${Date.now()}`;

    const history = sessions.get(sid) || [];

    history.push({
      role: 'user',
      content: message.trim()
    });

    const systemPrompt = `
You are Elena, the AI receptionist of Villa Eleni Beach Hotel, a 4-star family-friendly hotel in Greece.

Your mission:
- Answer like a highly professional real hotel receptionist
- Be warm, polished, helpful, and natural
- Support Greek and English
- If the guest writes in Greek, reply in Greek
- If the guest writes in English, reply in English

Critical behavior rules:
- Never greet again and again in every message
- Do not restart the conversation if the guest has already given information
- Do not ask again for information already provided in the current session
- Keep track of dates, number of adults, number of children, room preferences, breakfast, parking, and any other details mentioned
- Ask only ONE follow-up question at a time
- Be concise, elegant, and useful
- Do not sound robotic
- Do not use markdown, bullets, or formatting symbols in the reply
- Never invent hotel information outside the hotel knowledge provided below
- If the guest asks for a booking, guide them step by step
- If the guest already gave dates, do not ask again for dates
- If the guest already gave guest count, do not ask again for guest count
- If the guest asks about facilities, policies, transfer, breakfast, parking, children, or room types, answer directly from the hotel knowledge

Booking guidance:
- If missing dates, ask for dates
- If dates are known but guest count is missing, ask for adults/children
- If dates and guest count are known, recommend suitable room types from the hotel data
- If children are mentioned, consider family-friendly options first
- If the guest seems ready to proceed, ask for name, phone, and email in a natural way

Tone:
- Refined
- Friendly
- Calm
- Fast
- Reception-quality language

HOTEL KNOWLEDGE:
${hotelContext}
`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: systemPrompt,
      messages: history.map(item => ({
        role: item.role,
        content: item.content
      }))
    });

    const reply =
      response.content
        ?.filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n')
        .trim() || 'Δεν έχω απάντηση αυτή τη στιγμή.';

    history.push({
      role: 'assistant',
      content: reply
    });

    // Keep only last 12 turns to avoid bloating context
    sessions.set(sid, history.slice(-12));

    return res.json({
      reply,
      sessionId: sid
    });
  } catch (error) {
    console.error('Claude error:', error);
    return res.status(500).json({
      reply: 'Υπήρξε ένα προσωρινό σφάλμα. Δοκιμάστε ξανά.'
    });
  }
});

// Voice endpoint
router.post('/voice', (req, res) => {
  try {
    const { transcript } = req.body || {};

    return res.json({
      reply: transcript
        ? `Έλαβα το μήνυμά σας: ${transcript}`
        : 'Δεν έλαβα φωνητικό μήνυμα.'
    });
  } catch (error) {
    console.error('POST /voice error:', error);
    return res.status(500).json({
      reply: 'Voice endpoint error.'
    });
  }
});

module.exports = router;
