(() => {
  const SESSION_KEY        = "parkgo_current_user";
  const PROFILES_KEY       = "parkgo_profiles";
  const PAYMENT_KEY        = "parkgo_payment_wallet";
  const VEHICLE_KEY        = "parkgo_vehicle_registry";
  const PERMIT_KEY         = "parkgo_permits";
  const FEEDBACK_KEY       = "parkgo_feedback_rsvps";
  const RESERVATIONS_KEY   = "parkgo_reservations";
  const USERS_KEY          = "parkgo_users";

  const readStoreObject = (key) => {
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    }catch{
      return {};
    }
  };
  const writeStoreObject = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };
  const readUsers = () => {
    try{
      return JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
    }catch{
      return {};
    }
  };

  const readProfiles = () => {
    try{
      return JSON.parse(localStorage.getItem(PROFILES_KEY)||"{}");
    }catch{
      return {};
    }
  };
  const writeProfiles = (value) => localStorage.setItem(PROFILES_KEY, JSON.stringify(value));

  const localPart = (email) => (email || "").split("@")[0];

  const createId = (prefix="id") => `${prefix}_${Math.random().toString(36).slice(2,8)}${Date.now().toString(36)}`;

  const formatCurrency = (cents=0) => {
    const amount = Number.isFinite(cents) ? cents/100 : 0;
    return amount.toLocaleString("en-US",{style:"currency",currency:"USD"});
  };
  const formatDuration = (minutes=0) => {
    if(!minutes){ return "n/a"; }
    const hrs = Math.floor(minutes/60);
    const mins = minutes % 60;
    if(!hrs){ return `${mins}m`; }
    return mins ? `${hrs}h ${mins}m` : `${hrs}h`;
  };
  const formatDate = (iso) => {
    if(!iso){ return "n/a"; }
    const d = new Date(iso);
    if(Number.isNaN(d.getTime())){ return "n/a"; }
    return d.toLocaleDateString("en-US",{month:"short", day:"numeric"});
  };
  const timeAgo = (timestamp) => {
    const now = Date.now();
    const then = typeof timestamp === "string" ? new Date(timestamp).getTime() : Number(timestamp);
    if(!Number.isFinite(then)){ return "just now"; }
    const diff = Math.max(0, now - then);
    const minutes = Math.floor(diff/60000);
    if(minutes < 1) return "just now";
    if(minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes/60);
    if(hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours/24);
    return `${days}d ago`;
  };
  const isoDaysAgo = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - Math.abs(days));
    return d.toISOString();
  };
  const isoDaysFromNow = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  };
  const copyToClipboard = (text) => {
    if(navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(text).then(()=>true).catch(()=>false);
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly","");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    let success = false;
    try{
      success = document.execCommand("copy");
    }catch{
      success = false;
    }
    document.body.removeChild(textarea);
    return Promise.resolve(success);
  };
  const toTitleCase = (value) => {
    if(!value){ return ""; }
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  };

  function ensureProfile(){
    const all = readProfiles();
    const email = localStorage.getItem(SESSION_KEY) || "guest@example.com";
    const users = readUsers();
    const user = users[email];
    const formatNameFromUser = () => {
      if(!user){ return ""; }
      const first = (user.firstName || "").trim();
      const last = (user.lastName || "").trim();
      const parts = [];
      if(first){ parts.push(toTitleCase(first)); }
      if(last){ parts.push(toTitleCase(last)); }
      return parts.join(" ").trim();
    };
    const existing = all[email];
    if(!existing){
      const derivedName = formatNameFromUser();
      const defaultName = derivedName || toTitleCase(localPart(email));
      all[email] = {
        name: defaultName,
        email,
        plate:"",
        role: user?.role || "UMB Community",
        phone: "",
        address: "",
        apt: "",
        city: "",
        state: "",
        zip: "",
        photo: ""
      };
      writeProfiles(all);
      return all[email];
    }
    const profile = existing;
    let mutated = false;
    if((!profile.name || !profile.name.trim()) && user){
      const candidate = formatNameFromUser();
      if(candidate){
        profile.name = candidate;
        mutated = true;
      }
    }
    if(user?.role){
      const storedRole = (profile.role || "").trim().toLowerCase();
      if(!storedRole || storedRole === "umb community"){
        profile.role = user.role;
        mutated = true;
      }
    }else if(!profile.role){
      profile.role = "UMB Community";
      mutated = true;
    }
    ["phone","address","apt","city","state","zip","photo","plate"].forEach((key)=>{
      if(profile[key] === undefined){
        profile[key] = "";
        mutated = true;
      }
    });
    if(mutated){
      all[email] = profile;
      writeProfiles(all);
    }
    return profile;
  }

  function defaultPaymentRecord(){
    return {
      autopay:true,
      cadence:"every Monday at 9:00 AM ET",
      lastSync: Date.now(),
      creditsCents: 4275,
      history:[
        { id:"hist1", amountCents:1800, garage:"Campus Center Garage", dateIso:isoDaysAgo(6), durationMinutes:195 },
        { id:"hist2", amountCents:1500, garage:"West Garage", dateIso:isoDaysAgo(11), durationMinutes:175 },
        { id:"hist3", amountCents:2200, garage:"West Garage", dateIso:isoDaysAgo(20), durationMinutes:240 }
      ],
      methods:[]
    };
  }
  function ensurePayment(){
    const email = localStorage.getItem(SESSION_KEY) || "guest@example.com";
    const all = readStoreObject(PAYMENT_KEY);
    if(!all[email]){
      all[email] = defaultPaymentRecord();
      writeStoreObject(PAYMENT_KEY, all);
      return all[email];
    }
    const record = all[email];
    let mutated = false;
    const allowedGarages = new Set(["West Garage","Campus Center Garage"]);
    if(Array.isArray(record.history)){
      let sanitizedHistory = record.history.filter((item)=>allowedGarages.has(item.garage));
      if(!sanitizedHistory.length){
        sanitizedHistory = defaultPaymentRecord().history;
      }
      if(sanitizedHistory.length !== record.history.length){
        record.history = sanitizedHistory;
        mutated = true;
      }
    }
    if(mutated){
      all[email] = record;
      writeStoreObject(PAYMENT_KEY, all);
    }
    return record;
  }

  function defaultVehicleRecord(){
    return {
      vehicles:[],
      maintenance:[]
    };
  }
  function ensureVehicles(){
    const email = localStorage.getItem(SESSION_KEY) || "guest@example.com";
    const all = readStoreObject(VEHICLE_KEY);
    if(!all[email]){
      all[email] = defaultVehicleRecord();
      writeStoreObject(VEHICLE_KEY, all);
    }
    return all[email];
  }

  function defaultPermitRecord(){
    return {
      westGarage:true,
      campusCenter:true,
      evTier2:true
    };
  }
  function ensurePermits(){
    const email = localStorage.getItem(SESSION_KEY) || "guest@example.com";
    const all = readStoreObject(PERMIT_KEY);
    if(!all[email]){
      all[email] = defaultPermitRecord();
      writeStoreObject(PERMIT_KEY, all);
      return all[email];
    }
    const record = all[email];
    let mutated = false;

    if("campusGarage" in record && !("westGarage" in record)){
      record.westGarage = record.campusGarage;
      delete record.campusGarage;
      mutated = true;
    }
    if("lotD" in record){
      delete record.lotD;
      mutated = true;
    }

    const desired = defaultPermitRecord();
    Object.keys(desired).forEach((key)=>{
      if(!(key in record)){
        record[key] = desired[key];
        mutated = true;
      }
    });

    if(mutated){
      all[email] = record;
      writeStoreObject(PERMIT_KEY, all);
    }
    return record;
  }

  function ensureFeedback(){
    const email = localStorage.getItem(SESSION_KEY) || "guest@example.com";
    const all = readStoreObject(FEEDBACK_KEY);
    if(!all[email]){
      all[email] = { reservations:[] };
      writeStoreObject(FEEDBACK_KEY, all);
    }
    return all[email];
  }

  function readReservations(){
    try{
      return JSON.parse(localStorage.getItem(RESERVATIONS_KEY)||"[]");
    }catch{
      return [];
    }
  }
  function writeReservations(list){
    localStorage.setItem(RESERVATIONS_KEY, JSON.stringify(list));
  }

  function withStore(key, ensureFn, mutator){
    const email = localStorage.getItem(SESSION_KEY) || "guest@example.com";
    const all = readStoreObject(key);
    if(!all[email]){
      all[email] = ensureFn();
    }
    const result = mutator(all[email]);
    writeStoreObject(key, all);
    return result;
  }

  window.ProfileStore = {
    SESSION_KEY,
    PROFILES_KEY,
    PAYMENT_KEY,
    VEHICLE_KEY,
    PERMIT_KEY,
    FEEDBACK_KEY,
    RESERVATIONS_KEY,
    USERS_KEY,
    readProfiles,
    writeProfiles,
    readStoreObject,
    writeStoreObject,
    readUsers,
    readReservations,
    writeReservations,
    ensureProfile,
    ensurePayment,
    ensureVehicles,
    ensurePermits,
    ensureFeedback,
    getPayment: () => ensurePayment(),
    accessPayment: (mutator) => withStore(PAYMENT_KEY, defaultPaymentRecord, mutator),
    getVehicles: () => ensureVehicles(),
    accessVehicles: (mutator) => withStore(VEHICLE_KEY, defaultVehicleRecord, mutator),
    getPermits: () => ensurePermits(),
    accessPermits: (mutator) => withStore(PERMIT_KEY, defaultPermitRecord, mutator),
    getFeedback: () => ensureFeedback(),
    accessFeedback: (mutator) => withStore(FEEDBACK_KEY, () => ({reservations:[]}), mutator),
    createId,
    formatCurrency,
    formatDuration,
    formatDate,
    timeAgo,
    isoDaysAgo,
    isoDaysFromNow,
    copyToClipboard,
    localPart,
    toTitleCase
  };
})();
