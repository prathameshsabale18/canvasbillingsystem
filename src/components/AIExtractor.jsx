import React, { useState, useRef } from 'react';
import { UploadCloud, Loader2, Key, AlertCircle } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';

export default function AIExtractor({ onExtractedData }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem('canvas_creation_gemini_key') || import.meta.env.VITE_GEMINI_API_KEY || ''
  );
  const fileInputRef = useRef(null);

  const saveKey = (key) => {
    setApiKey(key);
    if (key) localStorage.setItem('canvas_creation_gemini_key', key);
  };

  const processFile = async (file) => {
    if (!file || !['application/pdf', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      setError('Please upload a valid PDF or JPG file.');
      return;
    }
    if (!apiKey) {
      setError('Please enter your Gemini API Key first.');
      return;
    }

    setError(null);
    setIsLoading(true);

    // Try models in order until one works
    const models = [
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.6-flash',
    ];

    let lastError = null;

    const mimeType = file.type === 'application/pdf' ? 'application/pdf' : 'image/jpeg';
    const fileType = file.type === 'application/pdf' ? 'PDF' : 'JPG';

    for (const model of models) {
      try {
        const base64Data = await readFileAsBase64(file);
        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
          model,
          contents: [
            `You are a data extractor. From this purchase order ${fileType}, extract ONLY these fields as compact JSON. Keep all string values SHORT (under 100 chars). Do not include any explanation.`,
            { inlineData: { mimeType, data: base64Data } }
          ],
          config: {
            responseMimeType: 'application/json',
            maxOutputTokens: 8192,
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                clientName:      { type: Type.STRING, description: 'The company issuing the PO' },
                poNo:            { type: Type.STRING, description: 'Purchase Order Number' },
                poDate:          { type: Type.STRING, description: 'Purchase Order Date' },
                clientAddress:   { type: Type.STRING, description: 'Delivery or billing address' },
                clientGstin:     { type: Type.STRING, description: 'GSTIN of the client' },
                clientVendorCode:{ type: Type.STRING, description: 'Our vendor code with the client' },
                items: {
                  type: Type.ARRAY,
                  description: 'List of line items/products',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      description: { type: Type.STRING, description: 'Item description or part code' },
                      quantity:    { type: Type.NUMBER, description: 'Quantity' },
                      rate:        { type: Type.NUMBER, description: 'Unit price' },
                      per:         { type: Type.STRING, description: 'Unit of measure e.g. Nos, Pcs' },
                      hsn:         { type: Type.STRING, description: 'HSN Code' }
                    }
                  }
                }
              }
            }
          }
        });

        const extractedData = safeParseJSON(response.text);
        onExtractedData(extractedData);
        setIsLoading(false);
        return; // success — stop trying
      } catch (err) {
        console.warn(`Model ${model} failed:`, err.message);
        lastError = err;
        // If it's not a model-availability error, don't try next model
        if (!err.message?.includes('NOT_FOUND') && !err.message?.includes('UNAVAILABLE') && !err.message?.includes('no longer available')) {
          break;
        }
      }
    }

    const lastErrorMessage = lastError?.message || '';
    if (lastErrorMessage.includes('reported as leaked') || lastErrorMessage.includes('PERMISSION_DENIED')) {
      localStorage.removeItem('canvas_creation_gemini_key');
      setApiKey('');
      setError('This Gemini API key was revoked because it was reported as leaked. Enter a new Gemini API key.');
    } else {
      setError(lastErrorMessage || `Failed to process ${fileType}.`);
    }
    setIsLoading(false);
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    processFile(e.dataTransfer.files[0]);
  };
  const handleFileChange = (e) => processFile(e.target.files[0]);

  // Safe JSON parser — no recovery (recovery corrupts data), just clean error
  const safeParseJSON = (raw) => {
    const clean = (raw || '').trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/, '')
      .trim();
    return JSON.parse(clean);
  };

  const readFileAsBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  return (
    <div>
      {/* API Key Row */}
      <div className="api-key-row" style={{ marginBottom: '14px' }}>
        <Key size={15} />
        <input
          type="password"
          placeholder="Gemini API Key — paste here (saved in browser)"
          value={apiKey}
          onChange={(e) => saveKey(e.target.value)}
        />
      </div>

      {/* Drop Zone */}
      <div
        className={`dropzone${isDragging ? ' drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/jpg"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {isLoading ? (
          <>
            <div className="dropzone-icon"><Loader2 size={20} className="spin" /></div>
            <h4>Extracting data from PO…</h4>
            <p>AI is reading your purchase order</p>
          </>
        ) : (
          <>
            <div className="dropzone-icon"><UploadCloud size={20} /></div>
            <h4>Drop Purchase Order PDF or JPG here</h4>
            <p>or click to browse — AI will auto-fill the form</p>
          </>
        )}
      </div>

      {error && (
        <div className="error-banner" style={{ marginTop: '10px' }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
