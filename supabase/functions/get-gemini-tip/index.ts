// Importa Deno e o cliente Supabase
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS (para permitir que seu site chame a função)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Em produção, mude '*' para seu domínio
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Trata a chamada OPTIONS (pré-flight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Pega a API Key do Gemini (armazenada nos Segredos do Supabase)
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'API Key não configurada no servidor' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  // Pega os dados enviados pelo front-end
  const { category, amount } = await req.json();

  const userQuery = `Eu gastei ${amount} moedas num item que classifiquei como '${category}'. Diga-me uma dica financeira mágica, motivacional e muito curta (máximo 15 palavras) sobre a importância de gastar (se for Necessidade) ou de equilibrar gastos (se for Desejo). Responda em Português de Portugal.`;
  const systemPrompt = "Aja como um mentor financeiro infantil, criando dicas fofas, mágicas e encorajadoras.";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    contents: [{ parts: [{ text: userQuery }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
  };

  try {
    // Chama a API da Gemini (do servidor, não do cliente)
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Erro na API Gemini: ${response.statusText}`);
    }

    const result = await response.json();
    const tip = result.candidates?.[0]?.content?.parts?.[0]?.text || "Ups! Sem dica desta vez, mas continua a poupar!";

    return new Response(JSON.stringify({ tip: tip }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});