
import { GoogleGenerativeAI } from "@google/generative-ai";

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    try {
        // Note: The SDK might not have a direct listModels, but we can try to fetch it via the REST endpoint directly if needed
        // or just try different versions.
        console.log("Testando conexão com a chave de API...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Oi");
        console.log("Resposta do Flash:", result.response.text());
    } catch (e: any) {
        console.error("Erro com Flash:", e.message);
        try {
            const modelPro = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
            const resultPro = await modelPro.generateContent("Oi");
            console.log("Resposta do Pro:", resultPro.response.text());
        } catch (e2: any) {
            console.error("Erro com Pro:", e2.message);
        }
    }
}

listModels();
