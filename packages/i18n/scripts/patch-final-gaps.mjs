import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, "..", "locales");
const LOCALES = ["en", "ar", "hi", "kn", "ml", "te", "ta", "fr", "nl"];

const screenGap = {
  en: {
    ownerApp: {
      complaints: {
        existingComplaintsWarning: "⚠ {{count}} existing complaint(s)",
        retractModalBody:
          "This will remove the {{type}} flag from {{name}}'s record. Other clubs will no longer see this complaint.",
      },
      home: {
        staffRoleAccessibility: "Staff role {{name}}. Tap to switch.",
      },
      settings: {
        disableTableBodyExtended:
          "This table will be hidden from the session grid. Historical sessions are preserved.",
        photoPickerDevBuildBody:
          "Install the latest development build of the owner app to upload club photos. Run: eas build --profile development --platform android",
        deleteAccountBodyDetailed:
          "Your login will be blocked immediately. Pending bookings will be auto-cancelled. Your data will be permanently deleted after 30 days. Type DELETE to confirm.",
      },
      financials: {
        perMinEquals: "/min = ",
      },
    },
  },
  ar: {
    ownerApp: {
      complaints: {
        existingComplaintsWarning: "⚠ {{count}} شكوى/شكاوى قائمة",
        retractModalBody:
          "سيؤدي هذا إلى إزالة علامة {{type}} من سجل {{name}}. لن ترى الأندية الأخرى هذه الشكوى بعد الآن.",
      },
      home: { staffRoleAccessibility: "دور الموظف {{name}}. اضغط للتبديل." },
      settings: {
        disableTableBodyExtended:
          "سيتم إخفاء هذه الطاولة من شبكة الجلسات. تبقى الجلسات السابقة محفوظة.",
        photoPickerDevBuildBody:
          "ثبّت أحدث نسخة تطويرية من تطبيق المالك لرفع صور النادي. نفّذ: eas build --profile development --platform android",
        deleteAccountBodyDetailed:
          "سيُحظر تسجيل دخولك فوراً. ستُلغى الحجوزات المعلقة تلقائياً. ستُحذف بياناتك نهائياً بعد 30 يوماً. اكتب DELETE للتأكيد.",
      },
      financials: { perMinEquals: "/دقيقة = " },
    },
  },
  hi: {
    ownerApp: {
      complaints: {
        existingComplaintsWarning: "⚠ {{count}} मौजूदा शिकायत(एँ)",
        retractModalBody:
          "यह {{name}} के रिकॉर्ड से {{type}} फ़्लैग हटा देगा। अन्य क्लब यह शिकायत नहीं देखेंगे।",
      },
      home: { staffRoleAccessibility: "स्टाफ़ भूमिका {{name}}। बदलने के लिए टैप करें।" },
      settings: {
        disableTableBodyExtended:
          "यह टेबल सेशन ग्रिड से छिप जाएगी। पिछले सेशन सुरक्षित रहेंगे।",
        photoPickerDevBuildBody:
          "क्लब फ़ोटो अपलोड करने के लिए ओनर ऐप का नवीनतम डेवलपमेंट बिल्ड इंस्टॉल करें। चलाएँ: eas build --profile development --platform android",
        deleteAccountBodyDetailed:
          "आपका लॉगिन तुरंत ब्लॉक हो जाएगा। लंबित बुकिंग स्वतः रद्द हो जाएंगी। 30 दिनों के बाद आपका डेटा स्थायी रूप से हटा दिया जाएगा। पुष्टि के लिए DELETE टाइप करें।",
      },
      financials: { perMinEquals: "/मिनट = " },
    },
  },
  kn: {
    ownerApp: {
      complaints: {
        existingComplaintsWarning: "⚠ {{count}} ಅಸ್ತಿತ್ವದಲ್ಲಿರುವ ದೂರು(ಗಳು)",
        retractModalBody:
          "ಇದು {{name}} ರೆಕಾರ್ಡ್‌ನಿಂದ {{type}} ಫ್ಲ್ಯಾಗ್ ಅನ್ನು ತೆಗೆದುಹಾಕುತ್ತದೆ. ಇತರ ಕ್ಲಬ್‌ಗಳು ಈ ದೂರನ್ನು ಇನ್ನು ಮುಂದೆ ನೋಡುವುದಿಲ್ಲ.",
      },
      home: { staffRoleAccessibility: "ಸಿಬ್ಬಂದಿ ಪಾತ್ರ {{name}}. ಬದಲಾಯಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ." },
      settings: {
        disableTableBodyExtended:
          "ಈ ಟೇಬಲ್ ಅನ್ನು ಸೆಷನ್ ಗ್ರಿಡ್‌ನಿಂದ ಮರೆಮಾಡಲಾಗುತ್ತದೆ. ಹಿಂದಿನ ಸೆಷನ್‌ಗಳು ಉಳಿಯುತ್ತವೆ.",
        photoPickerDevBuildBody:
          "ಕ್ಲಬ್ ಫೋಟೋಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಲು ಮಾಲೀಕರ ಅಪ್ಲಿಕೇಶನ್‌ನ ಇತ್ತೀಚಿನ ಡೆವಲಪ್‌ಮೆಂಟ್ ಬಿಲ್ಡ್ ಅನ್ನು ಸ್ಥಾಪಿಸಿ. ಚಲಾಯಿಸಿ: eas build --profile development --platform android",
        deleteAccountBodyDetailed:
          "ನಿಮ್ಮ ಲಾಗಿನ್ ತಕ್ಷಣ ನಿರ್ಬಂಧಿಸಲಾಗುತ್ತದೆ. ಬಾಕಿ ಬುಕಿಂಗ್‌ಗಳು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ರದ್ದಾಗುತ್ತವೆ. 30 ದಿನಗಳ ನಂತರ ನಿಮ್ಮ ಡೇಟಾ ಶಾಶ್ವತವಾಗಿ ಅಳಿಸಲಾಗುತ್ತದೆ. ದೃಢೀಕರಿಸಲು DELETE ಟೈಪ್ ಮಾಡಿ.",
      },
      financials: { perMinEquals: "/ನಿಮಿಷ = " },
    },
  },
  ml: {
    ownerApp: {
      complaints: {
        existingComplaintsWarning: "⚠ {{count}} നിലവിലുള്ള പരാതി(കൾ)",
        retractModalBody:
          "ഇത് {{name}} ന്റെ റെക്കോർഡിൽ നിന്ന് {{type}} ഫ്ലാഗ് നീക്കം ചെയ്യും. മറ്റ് ക്ലബുകൾക്ക് ഈ പരാതി കാണാൻ കഴിയില്ല.",
      },
      home: { staffRoleAccessibility: "സ്റ്റാഫ് റോൾ {{name}}. മാറ്റാൻ ടാപ്പ് ചെയ്യുക." },
      settings: {
        disableTableBodyExtended:
          "ഈ ടേബിൾ സെഷൻ ഗ്രിഡിൽ നിന്ന് മറയ്ക്കപ്പെടും. പഴയ സെഷനുകൾ സംരക്ഷിക്കപ്പെടും.",
        photoPickerDevBuildBody:
          "ക്ലബ് ഫോട്ടോകൾ അപ്‌ലോഡ് ചെയ്യാൻ ഏറ്റവും പുതിയ ഡെവലപ്‌മെന്റ് ബിൽഡ് ഇൻസ്റ്റാൾ ചെയ്യുക. പ്രവർത്തിപ്പിക്കുക: eas build --profile development --platform android",
        deleteAccountBodyDetailed:
          "നിങ്ങളുടെ ലോഗിൻ ഉടനടി ബ്ലോക്ക് ചെയ്യപ്പെടും. തീർപ്പാക്കാത്ത ബുക്കിംഗുകൾ ഓട്ടോമാറ്റിക് റദ്ദാക്കും. 30 ദിവസത്തിന് ശേഷം നിങ്ങളുടെ ഡാറ്റ ശാശ്വതമായി ഇല്ലാതാക്കും. സ്ഥിരീകരിക്കാൻ DELETE ടൈപ്പ് ചെയ്യുക.",
      },
      financials: { perMinEquals: "/മിനിറ്റ് = " },
    },
  },
  te: {
    ownerApp: {
      complaints: {
        existingComplaintsWarning: "⚠ {{count}} ఉన్న ఫిర్యాదు(లు)",
        retractModalBody:
          "ఇది {{name}} రికార్డ్ నుండి {{type}} ఫ్లాగ్‌ను తీసివేస్తుంది. ఇతర క్లబ్‌లు ఈ ఫిర్యాదును చూడలేరు.",
      },
      home: { staffRoleAccessibility: "స్టాఫ్ పాత్ర {{name}}. మార్చడానికి ట్యాప్ చేయండి." },
      settings: {
        disableTableBodyExtended:
          "ఈ టేబుల్ సెషన్ గ్రిడ్ నుండి దాచబడుతుంది. గత సెషన్లు సంరక్షించబడతాయి.",
        photoPickerDevBuildBody:
          "క్లబ్ ఫోటోలు అప్‌లోడ్ చేయడానికి యజమాని యాప్ యొక్క తాజా డెవలప్‌మెంట్ బిల్డ్‌ను ఇన్‌స్టాల్ చేయండి. అమలు చేయండి: eas build --profile development --platform android",
        deleteAccountBodyDetailed:
          "మీ లాగిన్ వెంటనే బ్లాక్ అవుతుంది. పెండింగ్ బుకింగ్‌లు ఆటోమేటిక్‌గా రద్దు అవుతాయి. 30 రోజుల తర్వాత మీ డేటా శాశ్వతంగా తొలగించబడుతుంది. నిర్ధారించడానికి DELETE టైప్ చేయండి.",
      },
      financials: { perMinEquals: "/నిమి = " },
    },
  },
  ta: {
    ownerApp: {
      complaints: {
        existingComplaintsWarning: "⚠ {{count}} உள்ள புகார்(கள்)",
        retractModalBody:
          "இது {{name}} இன் பதிவிலிருந்து {{type}} கொடியை அகற்றும். மற்ற கிளப்புகள் இந்த புகாரைப் பார்க்க முடியாது.",
      },
      home: { staffRoleAccessibility: "ஊழியர் பாத்திரம் {{name}}. மாற்ற தட்டவும்." },
      settings: {
        disableTableBodyExtended:
          "இந்த மேசை அமர்வு கட்டத்திலிருந்து மறைக்கப்படும். பழைய அமர்வுகள் பாதுகாக்கப்படும்.",
        photoPickerDevBuildBody:
          "கிளப் புகைப்படங்களை பதிவேற்ற சொந்தரி செயலியின் சமீபத்திய டெவலப்மென்ட் பில்டை நிறுவவும். இயக்கவும்: eas build --profile development --platform android",
        deleteAccountBodyDetailed:
          "உங்கள் உள்நுழைவு உடனடியாக தடுக்கப்படும். நிலுவையில் உள்ள முன்பதிவுகள் தானாக ரத்து செய்யப்படும். 30 நாட்களுக்குப் பிறகு உங்கள் தரவு நிரந்தரமாக நீக்கப்படும். உறுதிப்படுத்த DELETE என தட்டச்சு செய்யவும்.",
      },
      financials: { perMinEquals: "/நிமி = " },
    },
  },
  fr: {
    ownerApp: {
      complaints: {
        existingComplaintsWarning: "⚠ {{count}} plainte(s) existante(s)",
        retractModalBody:
          "Cela retirera le signalement {{type}} du dossier de {{name}}. Les autres clubs ne verront plus cette plainte.",
      },
      home: { staffRoleAccessibility: "Rôle du personnel {{name}}. Appuyez pour changer." },
      settings: {
        disableTableBodyExtended:
          "Cette table sera masquée de la grille des sessions. Les sessions passées sont conservées.",
        photoPickerDevBuildBody:
          "Installez la dernière version de développement de l'app propriétaire pour téléverser des photos du club. Exécutez : eas build --profile development --platform android",
        deleteAccountBodyDetailed:
          "Votre connexion sera bloquée immédiatement. Les réservations en attente seront annulées automatiquement. Vos données seront définitivement supprimées après 30 jours. Tapez DELETE pour confirmer.",
      },
      financials: { perMinEquals: "/min = " },
    },
  },
  nl: {
    ownerApp: {
      complaints: {
        existingComplaintsWarning: "⚠ {{count}} bestaande klacht(en)",
        retractModalBody:
          "Dit verwijdert de {{type}}-markering uit het dossier van {{name}}. Andere clubs zien deze klacht niet meer.",
      },
      home: { staffRoleAccessibility: "Personeelsrol {{name}}. Tik om te wisselen." },
      settings: {
        disableTableBodyExtended:
          "Deze tafel wordt verborgen in het sessierooster. Eerdere sessies blijven bewaard.",
        photoPickerDevBuildBody:
          "Installeer de nieuwste development build van de eigenaarsapp om clubfoto's te uploaden. Voer uit: eas build --profile development --platform android",
        deleteAccountBodyDetailed:
          "Je login wordt direct geblokkeerd. Openstaande boekingen worden automatisch geannuleerd. Je gegevens worden na 30 dagen permanent verwijderd. Typ DELETE om te bevestigen.",
      },
      financials: { perMinEquals: "/min = " },
    },
  },
};

function deepMergeOverwrite(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== "object") target[key] = {};
      deepMergeOverwrite(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

const accountBlocked = {
  en: {
    title: "Account unavailable",
    frozen: "Your account has been frozen. Contact support if you believe this is a mistake.",
    deletion:
      "Your account is scheduled for deletion. Sign out and use the cancellation link in your email if you want to keep your account.",
    hint: "Tap below to return to the login screen.",
    backToLogin: "Back to login",
  },
  ar: {
    title: "الحساب غير متاح",
    frozen: "تم تجميد حسابك. تواصل مع الدعم إذا كنت تعتقد أن هذا خطأ.",
    deletion:
      "حسابك مجدول للحذف. سجّل الخروج واستخدم رابط الإلغاء في بريدك إذا أردت الاحتفاظ بحسابك.",
    hint: "اضغط أدناه للعودة إلى شاشة تسجيل الدخول.",
    backToLogin: "العودة لتسجيل الدخول",
  },
  hi: {
    title: "खाता उपलब्ध नहीं",
    frozen: "आपका खाता फ़्रीज़ कर दिया गया है। यदि यह गलती लगे तो सपोर्ट से संपर्क करें।",
    deletion:
      "आपका खाता हटाने के लिए निर्धारित है। खाता रखने के लिए साइन आउट करें और ईमेल में रद्दीकरण लिंक का उपयोग करें।",
    hint: "लॉगिन स्क्रीन पर वापस जाने के लिए नीचे टैप करें।",
    backToLogin: "लॉगिन पर वापस",
  },
  kn: {
    title: "ಖಾತೆ ಲಭ್ಯವಿಲ್ಲ",
    frozen: "ನಿಮ್ಮ ಖಾತೆಯನ್ನು ಫ್ರೀಜ್ ಮಾಡಲಾಗಿದೆ. ಇದು ತಪ್ಪು ಎಂದು ನೀವು ಭಾವಿಸಿದರೆ ಬೆಂಬಲವನ್ನು ಸಂಪರ್ಕಿಸಿ.",
    deletion:
      "ನಿಮ್ಮ ಖಾತೆಯನ್ನು ಅಳಿಸಲು ನಿಗದಿಪಡಿಸಲಾಗಿದೆ. ಖಾತೆಯನ್ನು ಉಳಿಸಲು ಸೈನ್ ಔಟ್ ಮಾಡಿ ಮತ್ತು ಇಮೇಲ್‌ನಲ್ಲಿನ ರದ್ದತಿ ಲಿಂಕ್ ಬಳಸಿ.",
    hint: "ಲಾಗಿನ್ ಪರದೆಗೆ ಹಿಂತಿರುಗಲು ಕೆಳಗೆ ಟ್ಯಾಪ್ ಮಾಡಿ.",
    backToLogin: "ಲಾಗಿನ್‌ಗೆ ಹಿಂತಿರುಗಿ",
  },
  ml: {
    title: "അക്കൗണ്ട് ലഭ്യമല്ല",
    frozen: "നിങ്ങളുടെ അക്കൗണ്ട് ഫ്രീസ് ചെയ്തിരിക്കുന്നു. ഇത് തെറ്റാണെന്ന് തോന്നുന്നുവെങ്കിൽ സപ്പോർട്ടുമായി ബന്ധപ്പെടുക.",
    deletion:
      "നിങ്ങളുടെ അക്കൗണ്ട് ഇല്ലാതാക്കാൻ ഷെഡ്യൂൾ ചെയ്തിരിക്കുന്നു. അക്കൗണ്ട് നിലനിർത്താൻ സൈൻ ഔട്ട് ചെയ്ത് ഇമെയിലിലെ റദ്ദാക്കൽ ലിങ്ക് ഉപയോഗിക്കുക.",
    hint: "ലോഗിൻ സ്ക്രീനിലേക്ക് മടങ്ങാൻ താഴെ ടാപ്പ് ചെയ്യുക.",
    backToLogin: "ലോഗിനിലേക്ക് മടങ്ങുക",
  },
  te: {
    title: "ఖాతా అందుబాటులో లేదు",
    frozen: "మీ ఖాతా ఫ్రీజ్ చేయబడింది. ఇది తప్పు అని అనుకుంటే సపోర్ట్‌ను సంప్రదించండి.",
    deletion:
      "మీ ఖాతా తొలగింపు కోసం షెడ్యూల్ చేయబడింది. ఖాతాను ఉంచడానికి సైన్ అవుట్ చేసి ఇమెయిల్‌లోని రద్దు లింక్‌ను ఉపయోగించండి.",
    hint: "లాగిన్ స్క్రీన్‌కు తిరిగి వెళ్లడానికి క్రింద ట్యాప్ చేయండి.",
    backToLogin: "లాగిన్‌కు తిరిగి వెళ్లండి",
  },
  ta: {
    title: "கணக்கு கிடைக்கவில்லை",
    frozen: "உங்கள் கணக்கு உறையிடப்பட்டுள்ளது. இது தவறு என்று நினைத்தால் ஆதரவை தொடர்பு கொள்ளுங்கள்.",
    deletion:
      "உங்கள் கணக்கு நீக்கத்திற்கு திட்டமிடப்பட்டுள்ளது. கணக்கை வைத்திருக்க வெளியேறி மின்னஞ்சலில் உள்ள ரத்து இணைப்பைப் பயன்படுத்தவும்.",
    hint: "உள்நுழைவு திரைக்குத் திரும்ப கீழே தட்டவும்.",
    backToLogin: "உள்நுழைவுக்குத் திரும்பு",
  },
  fr: {
    title: "Compte indisponible",
    frozen: "Votre compte a été gelé. Contactez le support si vous pensez qu'il s'agit d'une erreur.",
    deletion:
      "Votre compte est programmé pour suppression. Déconnectez-vous et utilisez le lien d'annulation dans votre e-mail pour le conserver.",
    hint: "Appuyez ci-dessous pour revenir à l'écran de connexion.",
    backToLogin: "Retour à la connexion",
  },
  nl: {
    title: "Account niet beschikbaar",
    frozen: "Je account is bevroren. Neem contact op met support als je denkt dat dit een vergissing is.",
    deletion:
      "Je account staat gepland voor verwijdering. Log uit en gebruik de annuleringslink in je e-mail als je je account wilt behouden.",
    hint: "Tik hieronder om terug te gaan naar het inlogscherm.",
    backToLogin: "Terug naar inloggen",
  },
};

for (const locale of LOCALES) {
  const bundle = JSON.parse(readFileSync(join(localesDir, `${locale}.json`), "utf8"));
  if (!bundle.auth) bundle.auth = {};
  if (!bundle.auth.customer) bundle.auth.customer = {};
  bundle.auth.customer.accountBlocked = accountBlocked[locale];
  deepMergeOverwrite(bundle, screenGap[locale]);
  writeFileSync(join(localesDir, `${locale}.json`), `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  console.log(`Patched ${locale}.json`);
}

function leaves(o, x = "") {
  const keys = [];
  for (const [kk, v] of Object.entries(o)) {
    const pp = x ? `${x}.${kk}` : kk;
    if (v && typeof v === "object" && !Array.isArray(v)) keys.push(...leaves(v, pp));
    else keys.push(pp);
  }
  return keys;
}

const enK = leaves(JSON.parse(readFileSync(join(localesDir, "en.json"), "utf8")));
let ok = true;
for (const l of LOCALES.slice(1)) {
  const k = leaves(JSON.parse(readFileSync(join(localesDir, `${l}.json`), "utf8")));
  if (k.length !== enK.length) {
    ok = false;
    console.log(`parity fail ${l}: ${k.length} vs ${enK.length}`);
  }
}
console.log(`Final en key count: ${enK.length}, parity: ${ok}`);
