require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { GoogleGenAI } = require("@google/genai");

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
  polling: true,
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

console.log("Gemini Telegram Bot is running...");


// Split long Telegram messages
function splitMessage(text, limit = 4000) {

  const chunks = [];

  while (text.length > limit) {

    let part = text.substring(0, limit);

    const lastSpace = part.lastIndexOf(" ");

    if (lastSpace > 0) {
      part = part.substring(0, lastSpace);
    }

    chunks.push(part.trim());

    text = text.substring(part.length).trim();

  }


  if (text.length > 0) {
    chunks.push(text);
  }


  return chunks;

}



// Gemini AI request
async function generateAIResponse(message) {

  let attempts = 3;


  while (attempts > 0) {

    try {


      const response = await ai.models.generateContent({

        model: "gemini-flash-latest",

        contents: [
          {
            role: "user",
            parts: [
              {
                text: message
              }
            ]
          }
        ]

      });


      return response.text || "I couldn't generate a response.";


    }


    catch (error) {


      console.log(
        "Gemini error:",
        error.status,
        error.message
      );


      // Retry temporary errors
      if (
        error.status === 503 ||
        error.status === 429
      ) {


        attempts--;


        if (attempts === 0) {
          break;
        }


        console.log(
          "Gemini unavailable, retrying..."
        );


        await new Promise(resolve =>
          setTimeout(resolve, 5000)
        );


      }


      else {

        throw error;

      }

    }

  }


  throw new Error(
    "Gemini service unavailable."
  );

}




// Start command
bot.onText(/\/start/, async (msg) => {

  await bot.sendMessage(
    msg.chat.id,
    "👋 Hello! I am your Gemini AI Telegram bot. Ask me anything."
  );

});





// Messages
bot.on("message", async (msg) => {


  const chatId = msg.chat.id;

  const userMessage = msg.text;


  if (!userMessage) return;


  // Ignore commands
  if (userMessage.startsWith("/")) return;



  try {


    await bot.sendChatAction(
      chatId,
      "typing"
    );


    const answer = await generateAIResponse(
      userMessage
    );


    const messages = splitMessage(answer);



    for (const message of messages) {


      await bot.sendMessage(
        chatId,
        message
      );


      // prevent Telegram flood limits
      await new Promise(resolve =>
        setTimeout(resolve, 300)
      );


    }



  }


  catch(error) {


    console.log(
      "ERROR:",
      error.message
    );



    if (
      error.status === 429 ||
      error.message.includes("quota")
    ) {


      await bot.sendMessage(
        chatId,
        "⚠️ Gemini API quota exceeded. Please check your Google AI Studio quota or billing settings."
      );


    }


    else {


      await bot.sendMessage(
        chatId,
        "❌ Sorry, I cannot connect to Gemini right now. Please try again later."
      );


    }


  }


});