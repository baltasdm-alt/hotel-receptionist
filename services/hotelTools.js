const fs = require('fs');
const path = require('path');

// ─── Load data files ────────────────────────────────────────────────────────
const hotelInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/hotelInfo.json'), 'utf8'));
const roomsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/rooms.json'), 'utf8'));
const policiesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/policies.json'), 'utf8'));

// ─── Tool Definitions (for Anthropic API) ───────────────────────────────────
const toolDefinitions = [
  {
    name: 'checkAvailability',
    description: 'Check room availability for given dates and number of guests. Always call this before presenting room options.',
    input_schema: {
      type: 'object',
      properties: {
        checkIn: {
          type: 'string',
          description: 'Check-in date in YYYY-MM-DD format'
        },
        checkOut: {
          type: 'string',
          description: 'Check-out date in YYYY-MM-DD format'
        },
        adults: {
          type: 'integer',
          description: 'Number of adults'
        },
        children: {
          type: 'integer',
          description: 'Number of children (0 if none)'
        },
        childrenAges: {
          type: 'array',
          items: { type: 'integer' },
          description: 'Ages of children if any'
        }
      },
      required: ['checkIn', 'checkOut', 'adults', 'children']
    }
  },
  {
    name: 'getRoomTypes',
    description: 'Get full details about available room types including amenities, pricing, and suitability.',
    input_schema: {
      type: 'object',
      properties: {
        roomIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of room IDs to retrieve details for. If empty, returns all room types.'
        },
        adults: {
          type: 'integer',
          description: 'Number of adults, used to filter suitable rooms'
        },
        children: {
          type: 'integer',
          description: 'Number of children'
        }
      },
      required: []
    }
  },
  {
    name: 'getHotelPolicies',
    description: 'Retrieve hotel policies for cancellation, payment, check-in/out, pets, smoking, children, etc.',
    input_schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          enum: ['cancellation', 'payment', 'checkIn', 'checkOut', 'children', 'pets', 'smoking', 'damage', 'quietHours', 'pools', 'disability', 'groups', 'taxesAndFees', 'all'],
          description: 'The policy topic to retrieve'
        }
      },
      required: ['topic']
    }
  },
  {
    name: 'createReservationRequest',
    description: 'Create a reservation request after the guest has confirmed they want to book. This is a REQUEST — not a confirmed booking. The hotel team will review and confirm.',
    input_schema: {
      type: 'object',
      properties: {
        guestName: {
          type: 'string',
          description: 'Full name of the guest'
        },
        guestPhone: {
          type: 'string',
          description: 'Guest phone number'
        },
        guestEmail: {
          type: 'string',
          description: 'Guest email address'
        },
        checkIn: {
          type: 'string',
          description: 'Check-in date in YYYY-MM-DD format'
        },
        checkOut: {
          type: 'string',
          description: 'Check-out date in YYYY-MM-DD format'
        },
        adults: {
          type: 'integer',
          description: 'Number of adults'
        },
        children: {
          type: 'integer',
          description: 'Number of children'
        },
        childrenAges: {
          type: 'array',
          items: { type: 'integer' },
          description: 'Ages of children'
        },
        roomTypeId: {
          type: 'string',
          description: 'ID of the requested room type'
        },
        specialRequests: {
          type: 'string',
          description: 'Any special requests or notes from the guest'
        }
      },
      required: ['guestName', 'guestPhone', 'checkIn', 'checkOut', 'adults', 'children', 'roomTypeId']
    }
  },
  {
    name: 'handoffToHuman',
    description: 'Initiate a handoff to a human receptionist. Use for complaints, complex requests, group bookings, accessibility needs, or when unsure how to help.',
    input_schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Reason for handoff (e.g., complaint, group booking, special request, complex query)'
        },
        guestName: {
          type: 'string',
          description: 'Guest name if known'
        },
        urgency: {
          type: 'string',
          enum: ['low', 'normal', 'urgent'],
          description: 'Urgency level of the handoff'
        },
        summary: {
          type: 'string',
          description: 'Brief summary of the conversation so far for the human agent'
        }
      },
      required: ['reason', 'urgency']
    }
  }
];

// ─── Helper: Get Season ──────────────────────────────────────────────────────
function getSeason(dateStr) {
  const month = new Date(dateStr).getMonth() + 1;
  const { seasons } = roomsData;
  if (seasons.high.months.includes(month)) return 'highSeason';
  if (seasons.mid.months.includes(month)) return 'midSeason';
  return 'lowSeason';
}

// ─── Helper: Calculate nights ───────────────────────────────────────────────
function calcNights(checkIn, checkOut) {
  const ms = new Date(checkOut) - new Date(checkIn);
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

// ─── Tool Implementations ────────────────────────────────────────────────────

function checkAvailability({ checkIn, checkOut, adults, children, childrenAges = [] }) {
  const { fullyBookedDates, limitedAvailabilityDates, defaultAvailablePercentage } = roomsData.mockAvailability;

  // Check if any night in the range is fully booked
  const nights = calcNights(checkIn, checkOut);
  const dates = [];
  for (let i = 0; i < nights; i++) {
    const d = new Date(checkIn);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const blockedNights = dates.filter(d => fullyBookedDates.includes(d));
  const limitedNights = dates.filter(d => limitedAvailabilityDates.includes(d));

  if (blockedNights.length > 0) {
    return {
      available: false,
      message: `Unfortunately the hotel is fully booked on ${blockedNights.join(', ')}. We cannot accommodate a stay for these dates.`,
      checkIn,
      checkOut,
      nights,
      adults,
      children,
      availableRooms: []
    };
  }

  const totalGuests = adults + children;
  const season = getSeason(checkIn);
  const isLimited = limitedNights.length > 0;

  // Filter rooms by capacity
  const suitableRooms = roomsData.rooms.filter(r => {
    return r.maxAdults >= adults && (r.maxAdults + r.maxChildren) >= totalGuests;
  }).map(room => {
    // Simulate availability: randomly mark some units as booked
    const availableUnits = isLimited
      ? Math.max(1, Math.floor(room.totalUnits * 0.3))
      : Math.floor(room.totalUnits * defaultAvailablePercentage);

    return {
      roomId: room.id,
      roomType: room.type,
      shortName: room.shortName,
      category: room.category,
      availableUnits,
      pricePerNight: room.basePrice[season],
      season: season.replace('Season', ' season'),
      totalPrice: room.basePrice[season] * nights,
      nights,
      breakfastIncluded: room.breakfastIncluded,
      maxOccupancy: room.maxOccupancy,
      suitableFor: room.suitableFor
    };
  });

  return {
    available: suitableRooms.length > 0,
    checkIn,
    checkOut,
    nights,
    adults,
    children,
    childrenAges,
    isLimitedAvailability: isLimited,
    message: isLimited ? 'Limited availability for some nights in this period.' : 'Good availability for these dates.',
    availableRooms: suitableRooms
  };
}

function getRoomTypes({ roomIds = [], adults = 1, children = 0 }) {
  let rooms = roomsData.rooms;

  if (roomIds && roomIds.length > 0) {
    rooms = rooms.filter(r => roomIds.includes(r.id));
  } else if (adults || children) {
    const totalGuests = adults + children;
    rooms = rooms.filter(r => r.maxAdults >= adults && (r.maxAdults + r.maxChildren) >= totalGuests);
  }

  return {
    rooms: rooms.map(r => ({
      id: r.id,
      type: r.type,
      shortName: r.shortName,
      category: r.category,
      sizeSqm: r.sizeSqm,
      maxOccupancy: r.maxOccupancy,
      bedOptions: r.bedOptions,
      view: r.view,
      description: r.description,
      keyAmenities: r.amenities.slice(0, 6),
      allAmenities: r.amenities,
      breakfastIncluded: r.breakfastIncluded,
      suitableFor: r.suitableFor,
      pricing: r.basePrice
    })),
    childPolicy: roomsData.childPolicy,
    additionalFees: roomsData.additionalFees
  };
}

function getHotelPolicies({ topic }) {
  if (topic === 'all') {
    return policiesData;
  }

  if (!policiesData[topic]) {
    return {
      error: `Policy topic '${topic}' not found.`,
      availableTopics: Object.keys(policiesData)
    };
  }

  return {
    topic,
    policy: policiesData[topic]
  };
}

function createReservationRequest({
  guestName,
  guestPhone,
  guestEmail = '',
  checkIn,
  checkOut,
  adults,
  children,
  childrenAges = [],
  roomTypeId,
  specialRequests = ''
}) {
  const room = roomsData.rooms.find(r => r.id === roomTypeId);
  const nights = calcNights(checkIn, checkOut);
  const season = getSeason(checkIn);
  const pricePerNight = room ? room.basePrice[season] : null;
  const estimatedTotal = pricePerNight ? pricePerNight * nights : null;

  const reservationId = `RES-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const timestamp = new Date().toISOString();

  const reservation = {
    reservationId,
    status: 'PENDING_CONFIRMATION',
    createdAt: timestamp,
    guest: {
      name: guestName,
      phone: guestPhone,
      email: guestEmail
    },
    stay: {
      checkIn,
      checkOut,
      nights,
      adults,
      children,
      childrenAges
    },
    roomTypeId,
    roomTypeName: room ? room.type : 'Unknown',
    estimatedPricePerNight: pricePerNight,
    estimatedTotal,
    specialRequests,
    nextSteps: 'The reservations team will review this request and contact the guest within 2 hours to confirm availability and arrange payment.'
  };

  // In production: save to DB, trigger email, notify staff
  // For now: log to console
  console.log('\n📋 RESERVATION REQUEST CREATED:', JSON.stringify(reservation, null, 2));

  return {
    success: true,
    reservationId,
    message: `Reservation request created for ${guestName}. Reference: ${reservationId}.`,
    confirmationNote: 'This is a REQUEST — not yet confirmed. Our team will contact the guest within 2 hours.',
    estimatedTotal: estimatedTotal ? `€${estimatedTotal} (estimated, ${nights} nights at €${pricePerNight}/night)` : 'To be confirmed by reservations team',
    guestEmail: guestEmail || 'Not provided',
    nextSteps: reservation.nextSteps
  };
}

function handoffToHuman({ reason, guestName = 'Guest', urgency = 'normal', summary = '' }) {
  const handoffId = `HND-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const handoff = {
    handoffId,
    timestamp,
    guestName,
    reason,
    urgency,
    summary,
    assignedTo: 'Front Desk Team',
    status: urgency === 'urgent' ? 'IMMEDIATE' : 'QUEUED'
  };

  // In production: push to staff notification system / PBX
  console.log('\n🔔 HANDOFF TO HUMAN:', JSON.stringify(handoff, null, 2));

  const messages = {
    urgent: `I'm connecting you immediately with one of our team members. Please hold.`,
    normal: `I'm transferring you to our front desk team now. They'll be with you shortly.`,
    low: `I'll have one of our team members follow up with you. Can I take your contact number?`
  };

  return {
    success: true,
    handoffId,
    urgency,
    message: messages[urgency] || messages.normal,
    estimatedWait: urgency === 'urgent' ? 'Immediate' : '2–3 minutes',
    transferringTo: 'Villa Eleni Front Desk Team'
  };
}

// ─── Tool Router ─────────────────────────────────────────────────────────────
function executeTool(toolName, toolInput) {
  console.log(`\n🔧 Tool called: ${toolName}`, JSON.stringify(toolInput, null, 2));

  const tools = {
    checkAvailability,
    getRoomTypes,
    getHotelPolicies,
    createReservationRequest,
    handoffToHuman
  };

  if (!tools[toolName]) {
    return { error: `Unknown tool: ${toolName}` };
  }

  const result = tools[toolName](toolInput);
  console.log(`✅ Tool result:`, JSON.stringify(result, null, 2));
  return result;
}

module.exports = { toolDefinitions, executeTool, hotelInfo };
