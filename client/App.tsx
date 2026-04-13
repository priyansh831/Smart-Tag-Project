/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  useParams, 
  useNavigate,
  Link
} from 'react-router-dom';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  deleteDoc,
  serverTimestamp,
  Timestamp,
  increment
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Phone,
  PhoneIncoming,
  AlertTriangle, 
  Car, 
  MessageSquare, 
  Shield, 
  LogOut, 
  QrCode, 
  History, 
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  Menu,
  X,
  Lightbulb,
  AppWindow as WindowIcon,
  Ban,
  Wrench,
  ShieldCheck,
  Globe,
  Camera,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { db, auth } from './firebase';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Lazy initialization for Gemini AI
let aiInstance: any = null;
let SchemaTypeInstance: any = null;

const getAI = async () => {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "" || key === "undefined" || key === "null") return null;
    if (!aiInstance) {
      const genAI: any = await import("@google/genai");
      aiInstance = new genAI.GoogleGenAI(key);
      SchemaTypeInstance = genAI.SchemaType;
    }
    return { ai: aiInstance, SchemaType: SchemaTypeInstance };
  } catch (e) {
    console.warn("Gemini AI initialization skipped:", e);
    return null;
  }
};

// --- AI Logic ---
async function analyzeMessage(message: string, targetLang: string = "English") {
  const aiData = await getAI();
  if (!aiData) return { isValid: true, cleanedMessage: message }; // Fallback if no AI key
  const { ai, SchemaType } = aiData;

  try {
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Analyze this message sent to a vehicle owner: "${message}". 
      1. Check if it's spam, harassment, or invalid.
      2. If valid, summarize it into a clean, urgent notification tone.
      3. Translate the final message to ${targetLang} if it's in a different language.
      4. If invalid, explain why.` }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            isValid: { type: SchemaType.BOOLEAN },
            cleanedMessage: { type: SchemaType.STRING },
            translation: { type: SchemaType.STRING },
            reason: { type: SchemaType.STRING }
          },
          required: ["isValid", "cleanedMessage"]
        }
      }
    });
    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return { isValid: true, cleanedMessage: message }; // Fallback
  }
}

async function analyzeDamage(imageData: string) {
  const aiData = await getAI();
  if (!aiData) return { severity: "Unknown", report: "AI not configured." };
  const { ai, SchemaType } = aiData;

  try {
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [
          { text: "Analyze this image of vehicle damage. Provide a preliminary report including: 1. Estimated severity (Low/Medium/High), 2. Affected parts, 3. Suggested next steps for insurance." },
          { inlineData: { data: imageData.split(',')[1], mimeType: "image/jpeg" } }
        ]}
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            severity: { type: SchemaType.STRING },
            report: { type: SchemaType.STRING },
            parts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
          },
          required: ["severity", "report"]
        }
      }
    });
    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error("Damage analysis failed:", error);
    return { severity: "Unknown", report: "Could not analyze image." };
  }
}

// --- Components ---

const Navbar = ({ user }: { user: User | null }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <nav className="bg-black text-yellow-400 border-b-4 border-yellow-400 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="flex items-center gap-2 font-black text-xl tracking-tighter italic">
            <Shield className="w-6 h-6 fill-yellow-400" />
            SMART TAG
          </Link>
          
          <div className="hidden md:flex items-center gap-6">
            {user ? (
              <>
                <Link to="/dashboard" className="hover:underline font-bold">DASHBOARD</Link>
                <button 
                  onClick={() => signOut(auth)}
                  className="flex items-center gap-2 bg-yellow-400 text-black px-4 py-1 font-black rounded-sm hover:bg-yellow-300 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> LOGOUT
                </button>
              </>
            ) : (
              <button 
                onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
                className="bg-yellow-400 text-black px-6 py-2 font-black rounded-sm hover:bg-yellow-300 transition-all transform hover:scale-105"
              >
                OWNER LOGIN
              </button>
            )}
          </div>

          <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)}>
              {isOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden bg-black border-b-4 border-yellow-400 p-4 flex flex-col gap-4"
          >
            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setIsOpen(false)} className="font-bold">DASHBOARD</Link>
                <button onClick={() => signOut(auth)} className="text-left font-bold text-red-500">LOGOUT</button>
              </>
            ) : (
              <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="font-bold">OWNER LOGIN</button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const ScannerLanding = () => {
  const { tagId } = useParams();
  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [customMsg, setCustomMsg] = useState("");
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', msg: string } | null>(null);
  const [showICE, setShowICE] = useState(false);
  const [damageImage, setDamageImage] = useState<string | null>(null);

  useEffect(() => {
    if (!tagId) return;
    const fetchVehicle = async () => {
      const docRef = doc(db, "vehicles", tagId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setVehicle(data);
        if (data.parkedMode) {
          // Trigger high-priority alert on scan if in parked mode
          fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              vehicleId: tagId,
              type: 'security_alert',
              message: "SECURITY ALERT: Your vehicle tag was scanned while in Parked Mode.",
              ownerEmail: data.ownerEmail,
              ownerPhone: data.ownerPhone
            })
          });
        }
      }
      setLoading(false);
    };
    fetchVehicle();
  }, [tagId]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setDamageImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const sendMessage = async (type: string, content: string, extraData: any = {}) => {
    if (!tagId) return;
    setSending(true);
    setStatus(null);

    let finalContent = content;
    let translation = "";

    if (type === 'custom') {
      const analysis = await analyzeMessage(content);
      if (!analysis.isValid) {
        setStatus({ type: 'error', msg: analysis.reason || "Invalid content detected." });
        setSending(false);
        return;
      }
      finalContent = analysis.cleanedMessage;
      translation = analysis.translation || "";
    }

    if (type === 'damage' && damageImage) {
      setStatus({ type: 'info', msg: "AI is analyzing damage report..." });
      const analysis = await analyzeDamage(damageImage);
      finalContent = `DAMAGE REPORT: ${analysis.severity} severity. ${analysis.report}`;
      extraData.damageAnalysis = analysis.report;
      extraData.imageUrl = "MOCK_URL"; // In real app, upload to storage
    }

    try {
      await addDoc(collection(db, "vehicles", tagId, "messages"), {
        vehicleId: tagId,
        type,
        content: finalContent,
        originalContent: content,
        translation,
        status: 'sent',
        createdAt: serverTimestamp(),
        ...extraData
      });

      // Reward points for helpful alerts
      if (['blocking', 'lights', 'window', 'damage'].includes(type)) {
        await setDoc(doc(db, "vehicles", tagId), {
          points: increment(10)
        }, { merge: true });
      }
      
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          vehicleId: tagId,
          type,
          message: finalContent,
          ownerEmail: vehicle.ownerEmail,
          ownerPhone: vehicle.ownerPhone
        })
      });

      setStatus({ type: 'success', msg: type === 'damage' ? "Damage report sent to owner!" : "Owner notified via SMS & Email!" });
      setCustomMsg("");
      setDamageImage(null);
    } catch (e) {
      setStatus({ type: 'error', msg: "Failed to send message." });
    } finally {
      setSending(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-12 h-12 animate-spin text-yellow-400" />
      <p className="font-black italic">SCANNING TAG...</p>
    </div>
  );

  if (!vehicle) return (
    <div className="p-8 text-center">
      <XCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
      <h1 className="text-3xl font-black mb-2">TAG NOT FOUND</h1>
      <p className="text-gray-400">This QR code is either invalid or the vehicle is no longer registered.</p>
    </div>
  );

  return (
    <div className="max-w-md mx-auto p-6">
      {vehicle.parkedMode && (
        <div className="bg-red-600 text-white p-2 text-center font-black text-xs mb-4 animate-pulse">
          HIGH SECURITY: PARKED MODE ACTIVE
        </div>
      )}

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-yellow-400 p-6 rounded-none border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-8"
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-4">
            <Car className="w-10 h-10 text-black" />
            <div>
              <p className="text-xs font-black uppercase opacity-70">Vehicle Plate</p>
              <h2 className="text-3xl font-black tracking-tighter">{vehicle.plateNumber}</h2>
            </div>
          </div>
          {vehicle.permitInfo?.isValid && (
            <div className="bg-black text-yellow-400 px-2 py-1 text-[10px] font-black rounded-sm">
              PERMIT: {vehicle.permitInfo.zone}
            </div>
          )}
        </div>
        <p className="text-sm font-bold text-black/80 leading-tight">
          Select an option below to notify the owner securely.
        </p>
      </motion.div>

      <div className="grid gap-4">
        {vehicle.iceInfo?.enabled && (
          <button 
            onClick={() => setShowICE(!showICE)}
            className="flex items-center gap-4 bg-red-600 text-white border-4 border-black p-4 font-black text-left shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            <div className="bg-white text-red-600 p-2 rounded-sm"><Shield className="w-5 h-5" /></div>
            FIRST RESPONDER / ICE INFO
          </button>
        )}

        <AnimatePresence>
          {showICE && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-red-50 border-x-4 border-b-4 border-black p-4"
            >
              <p className="text-xs font-black text-red-600 uppercase mb-2">Emergency Information</p>
              <div className="space-y-2 font-bold text-sm">
                <p><span className="opacity-50">Medical:</span> {vehicle.iceInfo.medicalInfo}</p>
                <p><span className="opacity-50">Contact:</span> {vehicle.iceInfo.emergencyContact}</p>
              </div>
              <button 
                onClick={() => sendMessage('ice_access', "ICE Info was accessed by a scanner.")}
                className="mt-4 w-full bg-black text-white text-[10px] py-1 font-black"
              >
                LOG ACCESS
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <QuickButton 
          icon={<Ban className="w-5 h-5" />} 
          label="Vehicle is blocking me" 
          onClick={() => sendMessage('blocking', "Your vehicle is blocking someone's way.")}
          disabled={sending}
        />
        
        <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-xs font-black uppercase mb-2">Report Damage (AI Analysis)</p>
          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="damage-upload" />
          <label htmlFor="damage-upload" className="flex items-center justify-center gap-2 bg-gray-100 border-2 border-dashed border-black p-4 cursor-pointer hover:bg-gray-200 transition-colors">
            {damageImage ? <CheckCircle2 className="text-green-600" /> : <Car className="opacity-30" />}
            <span className="font-bold text-sm">{damageImage ? "Photo Ready" : "Upload Photo"}</span>
          </label>
          {damageImage && (
            <button 
              onClick={() => sendMessage('damage', "Damage reported with image.")}
              disabled={sending}
              className="mt-2 w-full bg-black text-yellow-400 py-2 font-black text-xs"
            >
              SEND DAMAGE REPORT
            </button>
          )}
        </div>

        <QuickButton 
          icon={<Phone className="w-5 h-5" />} 
          label="Request Emergency Call" 
          onClick={() => sendMessage('call_request', "EMERGENCY: The scanner is requesting an immediate voice call regarding your vehicle.")}
          disabled={sending}
          className="bg-red-600 text-white border-red-800 hover:bg-red-700 shadow-[4px_4px_0px_0px_rgba(153,27,27,1)]"
        />

        <div className="mt-4">
          <label className="block text-xs font-black uppercase mb-1 ml-1">Custom Message (AI Translated)</label>
          <div className="relative">
            <textarea 
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)}
              placeholder="Type in any language..."
              className="w-full bg-white border-4 border-black p-3 font-bold focus:outline-none focus:ring-0 min-h-[100px]"
            />
            <button 
              onClick={() => sendMessage('custom', customMsg)}
              disabled={sending || !customMsg.trim()}
              className="absolute bottom-4 right-4 bg-black text-yellow-400 p-2 rounded-sm disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {status && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              "mt-6 p-4 border-4 font-black flex items-center gap-3",
              status.type === 'success' ? "bg-green-100 border-green-600 text-green-800" : 
              status.type === 'info' ? "bg-blue-100 border-blue-600 text-blue-800" :
              "bg-red-100 border-red-600 text-red-800"
            )}
          >
            {status.type === 'success' ? <CheckCircle2 /> : status.type === 'info' ? <Loader2 className="animate-spin" /> : <AlertTriangle />}
            {status.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const QuickButton = ({ icon, label, onClick, disabled, className }: { icon: any, label: string, onClick: () => void, disabled?: boolean, className?: string }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex items-center gap-4 bg-white border-4 border-black p-4 font-black text-left hover:bg-yellow-50 transition-all active:translate-x-1 active:translate-y-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50",
      className
    )}
  >
    <div className={cn("bg-black text-yellow-400 p-2 rounded-sm", className?.includes('bg-red') && "bg-white text-red-600")}>{icon}</div>
    {label}
  </button>
);

const OwnerDashboard = ({ user }: { user: User }) => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [plate, setPlate] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [calling, setCalling] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Settings state
  const [parkedMode, setParkedMode] = useState(false);
  const [iceEnabled, setIceEnabled] = useState(false);
  const [medicalInfo, setMedicalInfo] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");

  const currentVehicle = useMemo(() => vehicles.find(v => v.id === selectedVehicle), [vehicles, selectedVehicle]);

  useEffect(() => {
    if (currentVehicle) {
      setParkedMode(currentVehicle.parkedMode || false);
      setIceEnabled(currentVehicle.iceInfo?.enabled || false);
      setMedicalInfo(currentVehicle.iceInfo?.medicalInfo || "");
      setEmergencyContact(currentVehicle.iceInfo?.emergencyContact || "");
    }
  }, [currentVehicle]);

  useEffect(() => {
    const q = query(collection(db, "vehicles"), where("ownerUid", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const vList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVehicles(vList);
      setLoading(false);
    });
    return unsubscribe;
  }, [user.uid]);

  useEffect(() => {
    if (!selectedVehicle) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db, "vehicles", selectedVehicle, "messages"), 
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, [selectedVehicle]);

  const deleteVehicle = async (vehicleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDeleteId !== vehicleId) {
      setConfirmDeleteId(vehicleId);
      setTimeout(() => setConfirmDeleteId(null), 3000); // Reset after 3s
      return;
    }
    
    try {
      await deleteDoc(doc(db, "vehicles", vehicleId));
      setConfirmDeleteId(null);
      if (selectedVehicle === vehicleId) {
        setSelectedVehicle(null);
      }
    } catch (err) {
      console.error("Error deleting vehicle:", err);
    }
  };

  const updateSettings = async () => {
    if (!selectedVehicle) return;
    try {
      await setDoc(doc(db, "vehicles", selectedVehicle), {
        parkedMode,
        iceInfo: {
          enabled: iceEnabled,
          medicalInfo,
          emergencyContact
        }
      }, { merge: true });
      setShowSettings(false);
    } catch (err) {
      console.error(err);
    }
  };

  const registerVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate || !phone) return;
    setRegistering(true);
    try {
      const newVehicleRef = doc(collection(db, "vehicles"));
      await setDoc(newVehicleRef, {
        plateNumber: plate.toUpperCase(),
        ownerUid: user.uid,
        ownerEmail: user.email,
        ownerPhone: phone, 
        parkedMode: false,
        points: 0,
        iceInfo: { enabled: false, medicalInfo: "", emergencyContact: "" },
        permitInfo: { isValid: false, zone: "", expiry: "" },
        serviceHistory: [],
        createdAt: serverTimestamp()
      });
      setPlate("");
      setPhone("");
    } catch (err) {
      console.error(err);
    } finally {
      setRegistering(false);
    }
  };

  if (loading) return <div className="p-8 text-center font-black">LOADING DASHBOARD...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Left: Registration & List */}
        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-black mb-4 flex items-center gap-2">
              <Car className="w-6 h-6" /> REGISTER VEHICLE
            </h2>
            <form onSubmit={registerVehicle} className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4">
              <div>
                <label className="block text-xs font-black uppercase mb-1">Plate Number</label>
                <input 
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                  placeholder="ABC-1234"
                  className="w-full border-4 border-black p-2 font-bold uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase mb-1">Notification Email</label>
                <input 
                  value={user.email || ""}
                  disabled
                  className="w-full border-4 border-black p-2 font-bold bg-gray-100 cursor-not-allowed"
                />
                <p className="text-[10px] font-bold text-gray-400 mt-1">Alerts will be sent to your Google email.</p>
              </div>
              <div>
                <label className="block text-xs font-black uppercase mb-1">Phone Number (For SMS Alerts)</label>
                <input 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 234 567 890"
                  className="w-full border-4 border-black p-2 font-bold"
                />
              </div>
              <button 
                type="submit"
                disabled={registering}
                className="w-full bg-black text-yellow-400 py-3 font-black hover:bg-gray-900 transition-colors flex justify-center items-center gap-2"
              >
                {registering ? <Loader2 className="animate-spin" /> : "CREATE SMART TAG"}
              </button>
            </form>
          </section>

          <section>
            <h2 className="text-2xl font-black mb-4 flex items-center gap-2">
              <QrCode className="w-6 h-6" /> YOUR VEHICLES
            </h2>
            <div className="space-y-4">
              {vehicles.length === 0 && <p className="text-gray-500 font-bold italic">No vehicles registered yet.</p>}
              {vehicles.map(v => (
                <div 
                  key={v.id}
                  onClick={() => setSelectedVehicle(v.id)}
                  className={cn(
                    "bg-white border-4 border-black p-4 cursor-pointer transition-all flex justify-between items-center",
                    selectedVehicle === v.id ? "bg-yellow-100 border-yellow-600 -translate-y-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" : "hover:bg-gray-50"
                  )}
                >
                  <div>
                    <h3 className="text-xl font-black">{v.plateNumber}</h3>
                    <p className="text-xs font-bold text-gray-500">ID: {v.id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={(e) => deleteVehicle(v.id, e)}
                      className={cn(
                        "p-2 transition-all rounded-sm font-black text-[10px] uppercase",
                        confirmDeleteId === v.id ? "bg-red-600 text-white" : "text-gray-400 hover:text-red-600"
                      )}
                      title="Delete Vehicle"
                    >
                      {confirmDeleteId === v.id ? "Confirm?" : <Trash2 className="w-5 h-5" />}
                    </button>
                    <QrCode className="w-6 h-6 opacity-30" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right: Details & Logs */}
        <div className="space-y-8">
          {selectedVehicle ? (
            <>
              <section className="bg-black text-yellow-400 p-8 border-4 border-yellow-400 flex flex-col items-center text-center relative">
                <div className="absolute top-4 right-4 flex gap-2">
                  <button 
                    onClick={() => setShowSettings(!showSettings)}
                    className="bg-yellow-400 text-black p-2 rounded-sm hover:bg-yellow-300"
                  >
                    <Shield className="w-4 h-4" />
                  </button>
                </div>

                <div className="mb-4 flex items-center gap-4">
                  <h3 className="text-xl font-black">YOUR SMART TAG</h3>
                  <div className="bg-yellow-400 text-black px-2 py-1 text-[10px] font-black rounded-sm flex items-center gap-1">
                    <History className="w-3 h-3" /> {currentVehicle?.points || 0} REWARDS
                  </div>
                </div>

                <AnimatePresence>
                  {showSettings ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="w-full bg-white text-black p-6 border-4 border-black text-left space-y-4"
                    >
                      <h4 className="font-black uppercase italic border-b-2 border-black pb-2">Vehicle Settings</h4>
                      
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-sm">Parked Mode (High Security)</label>
                        <input 
                          type="checkbox" 
                          checked={parkedMode} 
                          onChange={(e) => setParkedMode(e.target.checked)}
                          className="w-6 h-6 accent-black"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-sm">Enable ICE (Emergency Info)</label>
                          <input 
                            type="checkbox" 
                            checked={iceEnabled} 
                            onChange={(e) => setIceEnabled(e.target.checked)}
                            className="w-6 h-6 accent-black"
                          />
                        </div>
                        {iceEnabled && (
                          <div className="space-y-2 pl-4 border-l-4 border-red-600">
                            <input 
                              placeholder="Medical Info (e.g. Blood Type O+)" 
                              value={medicalInfo}
                              onChange={(e) => setMedicalInfo(e.target.value)}
                              className="w-full border-2 border-black p-2 text-xs font-bold"
                            />
                            <input 
                              placeholder="Emergency Contact Phone" 
                              value={emergencyContact}
                              onChange={(e) => setEmergencyContact(e.target.value)}
                              className="w-full border-2 border-black p-2 text-xs font-bold"
                            />
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={updateSettings}
                        className="w-full bg-black text-yellow-400 py-2 font-black text-sm uppercase"
                      >
                        SAVE SETTINGS
                      </button>
                    </motion.div>
                  ) : (
                    <>
                      <div className="bg-white p-4 mb-4">
                        <QRCodeSVG 
                          value={`${window.location.origin}/scan/${selectedVehicle}`} 
                          size={200}
                          level="H"
                        />
                      </div>
                      <p className="text-xs font-bold mb-4 opacity-70">Print this QR and place it on your windshield.</p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => window.print()}
                          className="bg-yellow-400 text-black px-6 py-2 font-black rounded-sm hover:bg-yellow-300"
                        >
                          PRINT TAG
                        </button>
                        {currentVehicle?.parkedMode && (
                          <div className="bg-red-600 text-white px-4 py-2 font-black rounded-sm flex items-center gap-2 animate-pulse">
                            <Shield className="w-4 h-4" /> SECURE
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </AnimatePresence>
              </section>

              <section>
                <h2 className="text-2xl font-black mb-4 flex items-center gap-2">
                  <History className="w-6 h-6" /> ACTIVITY LOG
                </h2>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {messages.length === 0 && <p className="text-gray-500 font-bold italic">No messages yet.</p>}
                  {messages.map(m => (
                    <div key={m.id} className={cn(
                      "bg-white border-2 border-black p-3",
                      m.type === 'call_request' && "border-red-500 bg-red-50 animate-pulse"
                    )}>
                      <div className="flex justify-between items-start mb-1">
                        <span className={cn(
                          "text-[10px] font-black uppercase px-1.5 py-0.5",
                          m.type === 'call_request' ? "bg-red-600 text-white" : "bg-black text-yellow-400"
                        )}>
                          {m.type === 'call_request' ? "EMERGENCY CALL" : m.type}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400">
                          {m.createdAt?.toDate().toLocaleString()}
                        </span>
                      </div>
                      <p className={cn("text-sm font-bold leading-tight", m.type === 'call_request' && "text-red-700")}>
                        {m.content}
                      </p>
                      {m.type === 'call_request' && (
                        <button 
                          onClick={() => {
                            setCalling(m.id);
                            setTimeout(() => setCalling(null), 5000);
                          }}
                          disabled={calling === m.id}
                          className="mt-2 w-full bg-red-600 text-white text-[10px] font-black py-1 rounded-sm flex items-center justify-center gap-1 hover:bg-red-700 disabled:opacity-50"
                        >
                          {calling === m.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" /> CONNECTING SECURE BRIDGE...
                            </>
                          ) : (
                            <>
                              <PhoneIncoming className="w-3 h-3" /> INITIATE SECURE CALL
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center border-4 border-dashed border-gray-300 p-12 text-center">
              <QrCode className="w-16 h-16 text-gray-200 mb-4" />
              <p className="font-black text-gray-300 uppercase">Select a vehicle to view its tag and logs</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LandingPage = () => (
  <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="max-w-2xl"
    >
      <div className="inline-block bg-yellow-400 text-black px-4 py-1 font-black text-sm mb-6 transform -rotate-2">
        PRIVACY-FIRST VEHICLE CONTACT
      </div>
      <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none mb-8 italic">
        DON'T SHARE YOUR <span className="text-yellow-400 bg-black px-2">NUMBER</span>
      </h1>
      <p className="text-xl font-bold text-gray-600 mb-12 max-w-lg mx-auto leading-tight">
        Protect your privacy. Use a Smart Tag to let people contact you about your vehicle without ever seeing your phone number.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button 
          onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
          className="bg-black text-yellow-400 px-10 py-4 font-black text-xl shadow-[8px_8px_0px_0px_rgba(254,240,138,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
        >
          GET STARTED FREE
        </button>
        <Link 
          to="/scan/demo-tag"
          className="bg-white border-4 border-black px-10 py-4 font-black text-xl hover:bg-yellow-50 transition-all"
        >
          VIEW DEMO
        </Link>
      </div>
    </motion.div>

    <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-12 text-left max-w-5xl">
      <Feature icon={<Shield />} title="Privacy First" desc="Your phone number is never exposed to the person scanning your tag." />
      <Feature icon={<MessageSquare />} title="AI Mediated" desc="Our AI filters spam and harassment before messages reach you." />
      <Feature icon={<AlertTriangle />} title="Instant Alerts" desc="Get notified immediately if your lights are on or if you're blocking someone." />
    </div>
  </div>
);

const Feature = ({ icon, title, desc }: { icon: any, title: string, desc: string }) => (
  <div className="space-y-3">
    <div className="bg-yellow-400 text-black w-12 h-12 flex items-center justify-center rounded-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      {icon}
    </div>
    <h3 className="text-xl font-black uppercase italic">{title}</h3>
    <p className="font-bold text-gray-500 leading-snug">{desc}</p>
  </div>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("SMART TAG APP v1.1 - AI FIX LOADED");
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <Loader2 className="w-12 h-12 animate-spin text-yellow-400" />
    </div>
  );

  return (
    <Router>
      <div className="min-h-screen bg-white font-sans selection:bg-yellow-200 selection:text-black">
        <Navbar user={user} />
        <main className="pb-20">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/scan/:tagId" element={<ScannerLanding />} />
            <Route 
              path="/dashboard" 
              element={user ? <OwnerDashboard user={user} /> : <LandingPage />} 
            />
          </Routes>
        </main>
        
        <footer className="bg-black text-yellow-400 p-8 border-t-4 border-yellow-400 text-center">
          <p className="font-black italic tracking-widest text-sm">SMART VEHICLE TAG &copy; 2026</p>
          <p className="text-[10px] font-bold opacity-50 mt-2">BUILT FOR PRIVACY & SAFETY</p>
        </footer>
      </div>
    </Router>
  );
}
