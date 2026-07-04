import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(root, "..", "locales");

const patches = {
  ar: {
    accountBlocked: {
      title: "الحساب غير متاح",
      frozen: "تم تجميد حسابك. تواصل مع الدعم إذا كنت تعتقد أن هذا خطأ.",
      deletion: "حسابك مجدول للحذف. سجّل الخروج واستخدم رابط الإلغاء في بريدك إذا أردت الاحتفاظ بحسابك.",
      hint: "اضغط أدناه للعودة إلى شاشة تسجيل الدخول.",
      backToLogin: "العودة لتسجيل الدخول",
    },
    users: {
      exportAll: "تصدير",
      exportConfirmTitle: "تصدير بيانات المستخدمين؟",
      exportConfirmBody:
        "تنزيل جدول بيانات (CSV) يمكن فتحه في Excel أو Google Sheets. يتضمن ملخصات الملف والنشاط. يحترم فلتر الدور الحالي.",
      exportDownload: "تنزيل",
      exportFailed: "فشل التصدير",
      exportTruncatedTitle: "تم تحديد التصدير",
      exportTruncatedBody:
        "تم تضمين أول {{count}} مستخدم فقط. ضيّق فلتر الدور أو تواصل مع الفريق التقني للأرشيف الكامل.",
    },
    userProfile: {
      downloadUserData: "تنزيل بيانات المستخدم",
      exporting: "جارٍ التصدير…",
      exportFailed: "فشل التصدير",
    },
  },
  hi: {
    accountBlocked: {
      title: "खाता उपलब्ध नहीं",
      frozen: "आपका खाता निलंबित कर दिया गया है। यदि यह गलती है तो सहायता से संपर्क करें।",
      deletion: "आपका खाता हटाने के लिए निर्धारित है। खाता रखने के लिए साइन आउट करें और ईमेल में रद्दीकरण लिंक का उपयोग करें।",
      hint: "लॉगिन स्क्रीन पर वापस जाने के लिए नीचे टैप करें।",
      backToLogin: "लॉगिन पर वापस",
    },
    users: {
      exportAll: "निर्यात",
      exportConfirmTitle: "उपयोगकर्ता डेटा निर्यात करें?",
      exportConfirmBody:
        "स्प्रेडशीट (CSV) डाउनलोड करें जिसे Excel या Google Sheets में खोला जा सकता है। प्रोफ़ाइल और गतिविधि सारांश शामिल। वर्तमान भूमिका फ़िल्टर का पालन करता है।",
      exportDownload: "डाउनलोड",
      exportFailed: "निर्यात विफल",
      exportTruncatedTitle: "निर्यात सीमित",
      exportTruncatedBody:
        "केवल पहले {{count}} उपयोगकर्ता शामिल किए गए। भूमिका फ़िल्टर संकीर्ण करें या पूर्ण संग्रह के लिए इंजीनियरिंग से संपर्क करें।",
    },
    userProfile: {
      downloadUserData: "उपयोगकर्ता डेटा डाउनलोड करें",
      exporting: "निर्यात हो रहा है…",
      exportFailed: "निर्यात विफल",
    },
  },
  kn: {
    accountBlocked: {
      title: "ಖಾತೆ ಲಭ್ಯವಿಲ್ಲ",
      frozen: "ನಿಮ್ಮ ಖಾತೆಯನ್ನು ಮುಚ್ಚಲಾಗಿದೆ. ಇದು ತಪ್ಪು ಎಂದು ನೀವು ಭಾವಿಸಿದರೆ ಬೆಂಬಲವನ್ನು ಸಂಪರ್ಕಿಸಿ.",
      deletion: "ನಿಮ್ಮ ಖಾತೆಯನ್ನು ಅಳಿಸಲು ನಿಗದಿಪಡಿಸಲಾಗಿದೆ. ಖಾತೆಯನ್ನು ಉಳಿಸಲು ಸೈನ್ ಔಟ್ ಮಾಡಿ ಮತ್ತು ಇಮೇಲ್‌ನಲ್ಲಿನ ರದ್ದು ಲಿಂಕ್ ಬಳಸಿ.",
      hint: "ಲಾಗಿನ್ ಪರದೆಗೆ ಹಿಂತಿರುಗಲು ಕೆಳಗೆ ಟ್ಯಾಪ್ ಮಾಡಿ.",
      backToLogin: "ಲಾಗಿನ್‌ಗೆ ಹಿಂತಿರುಗಿ",
    },
    users: {
      exportAll: "ರಫ್ತು",
      exportConfirmTitle: "ಬಳಕೆದಾರ ಡೇಟಾ ರಫ್ತು ಮಾಡುವುದೇ?",
      exportConfirmBody:
        "Excel ಅಥವಾ Google Sheets ನಲ್ಲಿ ತೆರೆಯಬಹುದಾದ ಸ್ಪ್ರೆಡ್‌ಶೀಟ್ (CSV) ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ. ಪ್ರೊಫೈಲ್ ಮತ್ತು ಚಟುವಟಿಕೆ ಸಾರಾಂಶಗಳನ್ನು ಒಳಗೊಂಡಿದೆ. ಪ್ರಸ್ತುತ ಪಾತ್ರ ಫಿಲ್ಟರ್ ಅನ್ನು ಗೌರವಿಸುತ್ತದೆ.",
      exportDownload: "ಡೌನ್‌ಲೋಡ್",
      exportFailed: "ರಫ್ತು ವಿಫಲ",
      exportTruncatedTitle: "ರಫ್ತು ಮಿತಿ",
      exportTruncatedBody:
        "ಮೊದಲ {{count}} ಬಳಕೆದಾರರನ್ನು ಮಾತ್ರ ಸೇರಿಸಲಾಗಿದೆ. ಪಾತ್ರ ಫಿಲ್ಟರ್ ಸಂಕುಚಿತಗೊಳಿಸಿ ಅಥವಾ ಪೂರ್ಣ ಆರ್ಕೈವ್‌ಗಾಗಿ ಎಂಜಿನಿಯರಿಂಗ್ ಅನ್ನು ಸಂಪರ್ಕಿಸಿ.",
    },
    userProfile: {
      downloadUserData: "ಬಳಕೆದಾರ ಡೇಟಾ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ",
      exporting: "ರಫ್ತು ಮಾಡಲಾಗುತ್ತಿದೆ…",
      exportFailed: "ರಫ್ತು ವಿಫಲ",
    },
  },
  ml: {
    accountBlocked: {
      title: "അക്കൗണ്ട് ലഭ്യമല്ല",
      frozen: "നിങ്ങളുടെ അക്കൗണ്ട് ഫ്രീസ് ചെയ്തു. ഇത് തെറ്റാണെന്ന് കരുതുന്നുവെങ്കിൽ പിന്തുണയെ ബന്ധപ്പെടുക.",
      deletion: "നിങ്ങളുടെ അക്കൗണ്ട് ഇല്ലാതാക്കാൻ ഷെഡ്യൂൾ ചെയ്തിട്ടുണ്ട്. അക്കൗണ്ട് നിലനിർത്താൻ സൈൻ ഔട്ട് ചെയ്ത് ഇമെയിലിലെ റദ്ദാക്കൽ ലിങ്ക് ഉപയോഗിക്കുക.",
      hint: "ലോഗിൻ സ്ക്രീനിലേക്ക് മടങ്ങാൻ താഴെ ടാപ്പ് ചെയ്യുക.",
      backToLogin: "ലോഗിനിലേക്ക് മടങ്ങുക",
    },
    users: {
      exportAll: "എക്സ്പോർട്ട്",
      exportConfirmTitle: "ഉപയോക്തൃ ഡാറ്റ എക്സ്പോർട്ട് ചെയ്യണോ?",
      exportConfirmBody:
        "Excel അല്ലെങ്കിൽ Google Sheets-ൽ തുറക്കാവുന്ന സ്പ്രെഡ്‌ഷീറ്റ് (CSV) ഡൗൺലോഡ് ചെയ്യുക. പ്രൊഫൈലും പ്രവർത്തന സംഗ്രഹവും ഉൾപ്പെടുന്നു. നിലവിലെ റോൾ ഫിൽട്ടർ പാലിക്കുന്നു.",
      exportDownload: "ഡൗൺലോഡ്",
      exportFailed: "എക്സ്പോർട്ട് പരാജയപ്പെട്ടു",
      exportTruncatedTitle: "എക്സ്പോർട്ട് പരിമിതം",
      exportTruncatedBody:
        "ആദ്യ {{count}} ഉപയോക്താക്കളെ മാത്രം ഉൾപ്പെടുത്തി. റോൾ ഫിൽട്ടർ കുറയ്ക്കുക അല്ലെങ്കിൽ പൂർണ്ണ ആർക്കൈവിനായി എഞ്ചിനീയറിംഗിനെ ബന്ധപ്പെടുക.",
    },
    userProfile: {
      downloadUserData: "ഉപയോക്തൃ ഡാറ്റ ഡൗൺലോഡ് ചെയ്യുക",
      exporting: "എക്സ്പോർട്ട് ചെയ്യുന്നു…",
      exportFailed: "എക്സ്പോർട്ട് പരാജയപ്പെട്ടു",
    },
  },
  te: {
    accountBlocked: {
      title: "ఖాతా అందుబాటులో లేదు",
      frozen: "మీ ఖాతా ఫ్రీజ్ చేయబడింది. ఇది తప్పు అని అనుకుంటే మద్దతును సంప్రదించండి.",
      deletion: "మీ ఖాతా తొలగింపు కోసం షెడ్యూల్ చేయబడింది. ఖాతా ఉంచుకోవడానికి సైన్ అవుట్ చేసి ఇమెయిల్‌లోని రద్దు లింక్ ఉపయోగించండి.",
      hint: "లాగిన్ స్క్రీన్‌కు తిరిగి వెళ్లడానికి క్రింద ట్యాప్ చేయండి.",
      backToLogin: "లాగిన్‌కు తిరిగి వెళ్లండి",
    },
    users: {
      exportAll: "ఎగుమతి",
      exportConfirmTitle: "వినియోగదారు డేటా ఎగుమతి చేయాలా?",
      exportConfirmBody:
        "Excel లేదా Google Sheetsలో తెరవగల స్ప్రెడ్‌షీట్ (CSV) డౌన్‌లోడ్ చేయండి. ప్రొఫైల్ మరియు కార్యాచరణ సారాంశాలు ఉంటాయి. ప్రస్తుత పాత్ర ఫిల్టర్‌ను పాటిస్తుంది.",
      exportDownload: "డౌన్‌లోడ్",
      exportFailed: "ఎగుమతి విఫలమైంది",
      exportTruncatedTitle: "ఎగుమతి పరిమితం",
      exportTruncatedBody:
        "మొదటి {{count}} వినియోగదారులు మాత్రమే చేర్చబడ్డారు. పాత్ర ఫిల్టర్‌ను సంకుచితం చేయండి లేదా పూర్తి ఆర్కైవ్ కోసం ఇంజనీరింగ్‌ను సంప్రదించండి.",
    },
    userProfile: {
      downloadUserData: "వినియోగదారు డేటా డౌన్‌లోడ్ చేయండి",
      exporting: "ఎగుమతి అవుతోంది…",
      exportFailed: "ఎగుమతి విఫలమైంది",
    },
  },
  ta: {
    accountBlocked: {
      title: "கணக்கு கிடைக்கவில்லை",
      frozen: "உங்கள் கணக்கு உறையிடப்பட்டது. இது தவறு என்று நினைத்தால் ஆதரவை தொடர்பு கொள்ளுங்கள்.",
      deletion: "உங்கள் கணக்கு நீக்கத்திற்கு திட்டமிடப்பட்டுள்ளது. கணக்கை வைத்திருக்க வெளியேறி மின்னஞ்சலில் உள்ள ரத்து இணைப்பைப் பயன்படுத்துங்கள்.",
      hint: "உள்நுழைவு திரைக்குத் திரும்ப கீழே தட்டவும்.",
      backToLogin: "உள்நுழைவுக்குத் திரும்பு",
    },
    users: {
      exportAll: "ஏற்றுமதி",
      exportConfirmTitle: "பயனர் தரவை ஏற்றுமதி செய்யவா?",
      exportConfirmBody:
        "Excel அல்லது Google Sheets-இல் திறக்கக்கூடிய விரிதாள் (CSV) பதிவிறக்கவும். சுயவிவரம் மற்றும் செயல்பாட்டு சுருக்கங்கள் அடங்கும். தற்போதைய பாத்திர வடிகட்டியை மதிக்கிறது.",
      exportDownload: "பதிவிறக்கம்",
      exportFailed: "ஏற்றுமதி தோல்வி",
      exportTruncatedTitle: "ஏற்றுமதி வரம்பு",
      exportTruncatedBody:
        "முதல் {{count}} பயனர்கள் மட்டுமே சேர்க்கப்பட்டனர். பாத்திர வடிகட்டியை குறுக்கவும் அல்லது முழு காப்பகத்திற்கு பொறியியல் குழுவை தொடர்பு கொள்ளவும்.",
    },
    userProfile: {
      downloadUserData: "பயனர் தரவை பதிவிறக்கு",
      exporting: "ஏற்றுமதி செய்யப்படுகிறது…",
      exportFailed: "ஏற்றுமதி தோல்வி",
    },
  },
  fr: {
    accountBlocked: {
      title: "Compte indisponible",
      frozen: "Votre compte a été gelé. Contactez le support si vous pensez qu'il s'agit d'une erreur.",
      deletion: "Votre compte est programmé pour suppression. Déconnectez-vous et utilisez le lien d'annulation dans votre e-mail pour conserver votre compte.",
      hint: "Appuyez ci-dessous pour revenir à l'écran de connexion.",
      backToLogin: "Retour à la connexion",
    },
    users: {
      exportAll: "Exporter",
      exportConfirmTitle: "Exporter les données utilisateur ?",
      exportConfirmBody:
        "Téléchargez une feuille de calcul (CSV) ouvrable dans Excel ou Google Sheets. Inclut les résumés de profil et d'activité. Respecte le filtre de rôle actuel.",
      exportDownload: "Télécharger",
      exportFailed: "Échec de l'export",
      exportTruncatedTitle: "Export limité",
      exportTruncatedBody:
        "Seuls les {{count}} premiers utilisateurs ont été inclus. Réduisez le filtre de rôle ou contactez l'équipe technique pour une archive complète.",
    },
    userProfile: {
      downloadUserData: "Télécharger les données utilisateur",
      exporting: "Export en cours…",
      exportFailed: "Échec de l'export",
    },
  },
  nl: {
    accountBlocked: {
      title: "Account niet beschikbaar",
      frozen: "Uw account is bevroren. Neem contact op met support als u denkt dat dit een vergissing is.",
      deletion: "Uw account staat gepland voor verwijdering. Log uit en gebruik de annuleringslink in uw e-mail om uw account te behouden.",
      hint: "Tik hieronder om terug te gaan naar het inlogscherm.",
      backToLogin: "Terug naar inloggen",
    },
    users: {
      exportAll: "Exporteren",
      exportConfirmTitle: "Gebruikersgegevens exporteren?",
      exportConfirmBody:
        "Download een spreadsheet (CSV) die u in Excel of Google Sheets kunt openen. Bevat profiel- en activiteitssamenvattingen. Respecteert het huidige rolfilter.",
      exportDownload: "Downloaden",
      exportFailed: "Exporteren mislukt",
      exportTruncatedTitle: "Export beperkt",
      exportTruncatedBody:
        "Alleen de eerste {{count}} gebruikers zijn opgenomen. Verfijn het rolfilter of neem contact op met engineering voor een volledig archief.",
    },
    userProfile: {
      downloadUserData: "Gebruikersgegevens downloaden",
      exporting: "Exporteren…",
      exportFailed: "Exporteren mislukt",
    },
  },
};

for (const [lang, patch] of Object.entries(patches)) {
  const mainPath = path.join(localesDir, `${lang}.json`);
  const main = JSON.parse(fs.readFileSync(mainPath, "utf8"));
  if (!main.auth?.customer) main.auth = main.auth || {};
  if (!main.auth.customer) main.auth.customer = {};
  if (!main.auth.customer.accountBlocked) main.auth.customer.accountBlocked = {};
  Object.assign(main.auth.customer.accountBlocked, patch.accountBlocked);
  Object.assign(main.adminApp.users, patch.users);
  Object.assign(main.adminApp.userProfile, patch.userProfile);
  fs.writeFileSync(mainPath, JSON.stringify(main, null, 2) + "\n");
  console.log(`gap keys patched: ${lang}`);
}

// en.json already has these from merge - verify
const en = JSON.parse(fs.readFileSync(path.join(localesDir, "en.json"), "utf8"));
if (!en.auth?.customer?.accountBlocked?.title) {
  Object.assign(en.auth.customer.accountBlocked, {
    title: "Account unavailable",
    frozen: "Your account has been frozen. Contact support if you believe this is a mistake.",
    deletion:
      "Your account is scheduled for deletion. Sign out and use the cancellation link in your email if you want to keep your account.",
    hint: "Tap below to return to the login screen.",
    backToLogin: "Back to login",
  });
  Object.assign(en.adminApp.users, {
    exportAll: "Export",
    exportConfirmTitle: "Export user data?",
    exportConfirmBody:
      "Download a spreadsheet (CSV) you can open in Excel or Google Sheets. Includes profile and activity summaries. Respects the current role filter.",
    exportDownload: "Download",
    exportFailed: "Export failed",
    exportTruncatedTitle: "Export capped",
    exportTruncatedBody:
      "Only the first {{count}} users were included. Narrow the role filter or contact engineering for a full archive.",
  });
  Object.assign(en.adminApp.userProfile, {
    downloadUserData: "Download user data",
    exporting: "Exporting…",
    exportFailed: "Export failed",
  });
  fs.writeFileSync(path.join(localesDir, "en.json"), JSON.stringify(en, null, 2) + "\n");
  console.log("en gap keys patched");
}
