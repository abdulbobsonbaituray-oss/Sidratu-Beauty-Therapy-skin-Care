import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function getGenAIClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

const CLINIC_SYSTEM_INSTRUCTION = `You are the helpful and professional virtual assistant and AI Skincare/Dental Concierge for Sidratu Beauty Therapy Skin Care.
Always be polite, welcoming, and empathetic to clients.

Key Information you must know:
- Location: 101 Jomo Kenyatta Road, Freetown, Sierra Leone.
- Open Hours: 9:00 AM to 7:30 PM (Opening hours: 9:00 AM, Closing hours: 7:30 PM).
- Primary Admin Contact: Sidratu Sesay (Sidratu82sesay@gmail.com | Phones: +232 77 533830, 033545691, 076553254)
- Co-Admin: Abdul Bobson Bai Turay (abdulbobsonbaituray@gmail.com)
- Services: Professional skin care, aesthetics, and dental clinic services — including HydraFacial Luxury Glow, Chemical Peels, Microneedling, PRP Rejuvenation, Stretch Marks & Skin Tag Removal, Laser Teeth Whitening, Dental Braces, Teeth Filling, Tooth Scaling & Polishing, Non-Surgical Nose Lift, Full Body Detox Polish, and IV Glutathione & Vitamin Glow Drip.
- Bookings: If a client wants to book a session, guide them to use the 'New Appointment' button.
- Pricing: Never quote prices; tell users pricing is handled privately in-clinic or on the main website.
- Tone: Keep your answers concise, friendly, and focused on beauty, health, and wellness (tailored to Freetown's tropical climate, e.g., SPF 50 protection and hydration). Do not answer questions unrelated to the clinic.`;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const server = http.createServer(app);

  // Cleanly handle any stale browser Service Worker requests in development
  if (process.env.NODE_ENV !== 'production') {
    app.get(['/dev-sw.js', '/sw.js', '/registerSW.js'], (_req, res) => {
      res
        .type('application/javascript')
        .set('Cache-Control', 'no-store')
        .send(
          `if (typeof self !== 'undefined' && self.registration) { self.registration.unregister(); }`
        );
    });
  }

  // =========================================================================
  // 1. MULTI-TURN GEMINI CHATBOT ENDPOINT (/api/gemini/chat)
  // Supports gemini-4-argon (complex), gemini-3.8-flash (general), gemini-3.1-flash-lite (fast)
  // =========================================================================
  app.post('/api/gemini/chat', async (req, res) => {
    try {
      const { messages, mode, roleContext } = req.body as {
        messages: Array<{ role: 'user' | 'model'; text: string }>;
        mode?: 'fast' | 'general' | 'complex';
        roleContext?: string;
      };

      const selectedModel =
        mode === 'fast'
          ? 'gemini-3.1-flash-lite'
          : mode === 'complex'
          ? 'gemini-4-argon'
          : 'gemini-3.8-flash';

      const ai = getGenAIClient();

      // Ensure multi-turn contents start with 'user' and strictly alternate roles
      const normalizedTurns: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
      for (const m of messages || []) {
        const text = (m?.text || '').trim();
        if (!text) continue;
        const role: 'user' | 'model' = m.role === 'model' ? 'model' : 'user';
        if (normalizedTurns.length === 0 && role === 'model') {
          // Skip initial UI welcome message from model so first turn is always 'user'
          continue;
        }
        const prev = normalizedTurns[normalizedTurns.length - 1];
        if (prev && prev.role === role) {
          prev.parts[0].text += `\n${text}`;
        } else {
          normalizedTurns.push({ role, parts: [{ text }] });
        }
      }

      const contents =
        normalizedTurns.length > 0
          ? normalizedTurns
          : [{ role: 'user' as const, parts: [{ text: 'Hello' }] }];

      const systemPrompt = roleContext
        ? `${CLINIC_SYSTEM_INSTRUCTION}\n\nCurrent User Context: ${roleContext}`
        : CLINIC_SYSTEM_INSTRUCTION;

      try {
        const response = await ai.models.generateContent({
          model: selectedModel,
          contents,
          config: {
            systemInstruction: systemPrompt
          }
        });

        res.json({
          text: response.text || 'I am ready to assist you with Sidratu Beauty Therapy care.',
          modelUsed: selectedModel
        });
      } catch (modelErr: any) {
        // Gracefully fallback to gemini-3.8-flash if the primary model fails
        if (selectedModel !== 'gemini-3.8-flash') {
          const fallbackResponse = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents,
            config: {
              systemInstruction: systemPrompt
            }
          });
          res.json({
            text: fallbackResponse.text || 'I am ready to assist you with Sidratu Beauty Therapy care.',
            modelUsed: 'gemini-3.8-flash'
          });
        } else {
          throw modelErr;
        }
      }
    } catch (error: any) {
      console.error('Chat API Error:', error);
      res.status(500).json({
        error: error?.message || 'Failed to generate chat response.'
      });
    }
  });

  // =========================================================================
  // 2. GOOGLE SEARCH GROUNDING ENDPOINT (/api/gemini/search)
  // Uses gemini-3.8-flash with googleSearch tool
  // =========================================================================
  app.post('/api/gemini/search', async (req, res) => {
    try {
      const { query } = req.body as { query: string };
      if (!query) {
        res.status(400).json({ error: 'Search query is required.' });
        return;
      }

      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: query,
        config: {
          systemInstruction:
            'You are a dermatological, dental, and aesthetic research assistant for Sidratu Beauty Therapy Skin Care in Freetown. Provide up-to-date, evidence-based skincare, ingredient, and dental care answers grounded in Google Search.',
          tools: [{ googleSearch: {} }]
        }
      });

      const rawChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = rawChunks
        .filter((c: any) => c.web?.uri)
        .map((c: any) => ({
          title: c.web.title || c.web.uri,
          uri: c.web.uri
        }));

      res.json({
        text: response.text || 'No search summary returned.',
        sources
      });
    } catch (error: any) {
      console.error('Search Grounding Error:', error);
      res.status(500).json({
        error: error?.message || 'Failed to execute Google Search grounding.'
      });
    }
  });

  // =========================================================================
  // 3. GOOGLE MAPS GROUNDING ENDPOINT (/api/gemini/maps)
  // Uses gemini-3.8-flash with googleMaps tool (NO responseMimeType/Schema)
  // =========================================================================
  app.post('/api/gemini/maps', async (req, res) => {
    try {
      const { query, latitude, longitude } = req.body as {
        query: string;
        latitude?: number;
        longitude?: number;
      };

      // Default coordinates: Freetown, Sierra Leone (near Jomo Kenyatta Road)
      const lat = typeof latitude === 'number' ? latitude : 8.479;
      const lng = typeof longitude === 'number' ? longitude : -13.246;

      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents:
          query ||
          'Find directions, nearby pharmacies, landmarks, and transport routes around 101 Jomo Kenyatta Road, Freetown, Sierra Leone.',
        config: {
          systemInstruction:
            'You are the Location & Local Directory Assistant for Sidratu Beauty Therapy Skin Care at 101 Jomo Kenyatta Road, Freetown, Sierra Leone. Help clients find directions, nearby landmarks, pharmacies, and wellness spots in Freetown.',
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: lat,
                longitude: lng
              }
            }
          }
        }
      });

      const rawChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const places: Array<{
        title: string;
        uri: string;
        reviewSnippets?: string[];
      }> = [];

      for (const chunk of rawChunks as any[]) {
        if (chunk.maps?.uri) {
          const snippets: string[] = [];
          const answerSources = chunk.maps.placeAnswerSources;
          if (answerSources?.reviewSnippets && Array.isArray(answerSources.reviewSnippets)) {
            for (const s of answerSources.reviewSnippets) {
              if (typeof s === 'string') snippets.push(s);
              else if (s?.text) snippets.push(s.text);
              else if (s?.reviewText) snippets.push(s.reviewText);
            }
          }
          places.push({
            title: chunk.maps.title || 'View on Google Maps',
            uri: chunk.maps.uri,
            reviewSnippets: snippets
          });
        }
      }

      res.json({
        text: response.text || 'No map information returned.',
        places
      });
    } catch (error: any) {
      console.error('Maps Grounding Error:', error);
      res.status(500).json({
        error: error?.message || 'Failed to execute Google Maps grounding.'
      });
    }
  });

  // =========================================================================
  // 4. GEMINI 3.8 LIVE API WEBSOCKET BRIDGE (/live)
  // Real-time low-latency voice conversation using gemini-3.8-live
  // =========================================================================
  const wss = new WebSocketServer({ noServer: true });
  const viteFallbackWss = new WebSocketServer({ noServer: true });

  viteFallbackWss.on('connection', ws => {
    try {
      ws.send(JSON.stringify({ type: 'connected' }));
    } catch {}
    ws.on('error', () => {});
  });

  server.on('upgrade', (request, socket, head) => {
    try {
      const pathname = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`).pathname;
      if (pathname === '/live') {
        wss.handleUpgrade(request, socket, head, ws => {
          wss.emit('connection', ws, request);
        });
      } else {
        viteFallbackWss.handleUpgrade(request, socket, head, ws => {
          viteFallbackWss.emit('connection', ws, request);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', async clientWs => {
    let sessionPromise: Promise<any> | null = null;
    try {
      const ai = getGenAIClient();
      sessionPromise = ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' }
            }
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction:
            CLINIC_SYSTEM_INSTRUCTION +
            ' You are speaking live over voice with a client or staff member of Sidratu Beauty Therapy Skin Care at 101 Jomo Kenyatta Road, Freetown. Keep spoken responses warm, natural, and concise.'
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== 1) return;

            const parts = message.serverContent?.modelTurn?.parts || [];
            for (const part of parts) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }

            const outTranscript =
              (message.serverContent as any)?.outputTranscription?.text;
            if (outTranscript) {
              clientWs.send(
                JSON.stringify({ outputTranscript: outTranscript })
              );
            }

            const inTranscript =
              (message.serverContent as any)?.inputTranscription?.text;
            if (inTranscript) {
              clientWs.send(
                JSON.stringify({ inputTranscript: inTranscript })
              );
            }

            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onerror: (err: any) => {
            console.error('Gemini Live session error:', err);
            if (clientWs.readyState === 1) {
              clientWs.send(
                JSON.stringify({
                  error: err?.message || 'Live voice session encountered an error.'
                })
              );
            }
          }
        }
      });

      const session = await sessionPromise;
      if (clientWs.readyState === 1) {
        clientWs.send(JSON.stringify({ status: 'connected' }));
      }

      clientWs.on('message', data => {
        if (!sessionPromise) return;
        sessionPromise
          .then(activeSession => {
            try {
              const parsed = JSON.parse(data.toString());
              if (parsed.audio) {
                activeSession.sendRealtimeInput({
                  audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' }
                });
              } else if (parsed.text) {
                activeSession.sendRealtimeInput({
                  text: parsed.text
                });
              }
            } catch (e) {
              console.error('Failed to process live input message:', e);
            }
          })
          .catch(() => {});
      });

      clientWs.on('close', () => {
        if (session) {
          try {
            session.close();
          } catch {}
        }
      });
    } catch (err: any) {
      console.error('Failed to initialize Gemini Live session:', err);
      if (clientWs.readyState === 1) {
        clientWs.send(
          JSON.stringify({
            error: err?.message || 'Could not connect to Gemini Live voice service.'
          })
        );
      }
    }
  });

  // Mount Vite middleware in development or static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'spa'
    });

    // Prevent Vite 8's /@vite/client from opening a failing HMR WebSocket to port 24678 in Cloud Run / AI Studio
    app.get('/@vite/client', async (_req, res, next) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (result?.code) {
          const patched = result.code
            .replace(
              'const createWebSocketModuleRunnerTransport = (options) => {',
              'const createWebSocketModuleRunnerTransport = (_options) => ({ async connect() {}, async disconnect() {}, send() {} }); const _unusedWsTransport = (options) => {'
            )
            .replace(
              'transport.connect(createHMRHandler(handleMessage));',
              '/* HMR WebSocket disabled in AI Studio */'
            )
            .replace(
              'setupForwardConsoleHandler(transport, forwardConsole);',
              '/* forwardConsole disabled */'
            );
          res
            .type('application/javascript')
            .set('Cache-Control', 'no-store')
            .send(patched);
          return;
        }
      } catch {}
      next();
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Sidratu Beauty Therapy Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
