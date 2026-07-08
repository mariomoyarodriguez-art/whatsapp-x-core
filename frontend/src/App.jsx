import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, MoreVertical, Search, Paperclip, Smile, Mic, 
  CheckCheck, LogOut, Image as ImageIcon, Camera, FileText, 
  Phone, Video, User, Edit2, ArrowLeft, Save, Users, Plus, Play, Square, UserPlus, Info, Globe, Briefcase, Trash2, X, Languages, Check,
  Eye, EyeOff
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;
const NOTIFICATION_SOUND = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');

const COMMON_EMOJIS = ['😀', '😂', '😍', '🥺', '😎', '👍', '👎', '🔥', '❤️', '🎉', '🤔', '😭', '😡', '👀', '✨', '🙌', '👋', '🙏', '💪', '💩', '👻', '💃', '🕺', '🎶', '🍕', '🍻', '🚀', '✅', '❌', '💯'];

const TARGET_LANGUAGES = [
    { code: 'ES', name: 'Español', flag: '🇪🇸' },
    { code: 'EN', name: 'Inglés', flag: '🇺🇸' },
    { code: 'FR', name: 'Francés', flag: '🇫🇷' },
    { code: 'DE', name: 'Alemán', flag: '🇩🇪' },
    { code: 'IT', name: 'Italiano', flag: '🇮🇹' },
    { code: 'PT', name: 'Portugués', flag: '🇵🇹' },
];

const normalizeText = (text) => text ? text.toString().toLowerCase().replace(/\s+/g, ' ').trim() : '';

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300; 
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6)); 
      };
      img.onerror = () => resolve(null);
    };
  });
};

export default function WhatsAppSQL() {
  // ESTADOS PRINCIPALES
  const [user, setUser] = useState(null);           
  const [loading, setLoading] = useState(true);     
  const [view, setView] = useState('auth');         
  const [isWakingUp, setIsWakingUp] = useState(false);
  const [activeChat, setActiveChat] = useState(null);   
  const [chatUser, setChatUser] = useState(null);       
  const [groupMembers, setGroupMembers] = useState([]); 
  const [messages, setMessages] = useState([]);         
  
  const [chatList, setChatList] = useState([]);       
  const [contacts, setContacts] = useState([]);       
  const [departamentos, setDepartamentos] = useState([]); 
  
  const [inputText, setInputText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false); 
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [mediaViewer, setMediaViewer] = useState(null);

  const [isSearchingChat, setIsSearchingChat] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  
  const [translateMenuMsgId, setTranslateMenuMsgId] = useState(null); 
  const [translationResult, setTranslationResult] = useState(null);   
  
  const [searchPhone, setSearchPhone] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [authMode, setAuthMode] = useState('login');

  // Para la barra de búsqueda principal y letrero Demo
  const [mainMenuSearch, setMainMenuSearch] = useState(''); 
  const [showDemoWarning, setShowDemoWarning] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', action: null });
  
  // ESTADOS DE FORMULARIOS Y CONTRASEÑAS 
  const [loginIdentifier, setLoginIdentifier] = useState(''); 
  const [password, setPassword] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false); 

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passForm, setPassForm] = useState({ actual: '', nueva: '', confirmar: '' });
  const [showPassActual, setShowPassActual] = useState(false);
  const [showPassNueva, setShowPassNueva] = useState(false);
  const [showPassConfirmar, setShowPassConfirmar] = useState(false);
  
  const [regData, setRegData] = useState({ num_Tel: '', nombre: '', apellido_pat: '', apellido_mat: '', correo: '', puesto: '', id_dep: '', password: '' });
  const [profileData, setProfileData] = useState({ displayName: '', phone: '', status: '', photoURL: '' });

  const scrollRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const lastProcessedMsgId = useRef(null); 
  const pollingInterval = useRef(null);

  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3500);
  };

  const [demoTranslationCount, setDemoTranslationCount] = useState(0);

  const DEMO_CONTACTS = [
      { num_Tel: '1111111111', name: 'Ana', apellido_pat: 'Gómez', puesto: 'Recursos Humanos', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ana' },
      { num_Tel: '2222222222', name: 'Carlos', apellido_pat: 'Dev', puesto: 'Líder Técnico', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carlos' }
  ];

  const DEMO_CHATS = [
      { id: 'chat_demo_1', isGroup: false, name: 'Ana Gómez', otherTel: '1111111111', lastMessage: 'I am very impressed with this translation feature. Can you test it?', timestamp: Date.now(), lastTime: '10:00 AM', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ana' },
      { id: 'group_demo_1', isGroup: true, name: 'Tech Team Alpha', lastMessage: 'La arquitectura en Oracle Cloud es muy sólida.', timestamp: Date.now() - 3600000, lastTime: 'Ayer', photoURL: 'https://api.dicebear.com/7.x/initials/svg?seed=Tech' }
  ];

  const DEMO_MESSAGES_ANA = [
      { id_msg: 'demo_msg_1', contenido: 'Hola, estuve revisando el portafolio y el código fuente.', tipo_msg: 'text', hora_envio: new Date(Date.now() - 60000).toISOString(), isMe: false, senderId: '1111111111', status: 'visto' },
      { id_msg: 'demo_msg_2', contenido: '¡Hola Ana! Muchas gracias. Todo está corriendo sobre Node.js y Oracle Database 21c.', tipo_msg: 'text', hora_envio: new Date(Date.now() - 40000).toISOString(), isMe: true, senderId: '0000000000', status: 'visto' },
      { id_msg: 'demo_msg_3', contenido: 'I am very impressed with this translation feature. Can you test it?', tipo_msg: 'text', hora_envio: new Date(Date.now() - 10000).toISOString(), isMe: false, senderId: '1111111111', status: 'visto' }
  ];

  const DEMO_MESSAGES_GROUP = [
      { id_msg: 'demo_msg_4', contenido: 'La arquitectura en Oracle Cloud es muy sólida.', tipo_msg: 'text', hora_envio: new Date(Date.now() - 3600000).toISOString(), isMe: false, senderId: '2222222222', senderName: 'Carlos Dev', status: 'visto' }
  ];
  const DEMO_GROUP_MEMBERS = [
      { num_Tel: '0000000000', nombre: 'Reclutador', apellido_pat: 'Demo', foto_perfil: 'https://api.dicebear.com/7.x/initials/svg?seed=Reclutador' },
      { num_Tel: '2222222222', nombre: 'Carlos', apellido_pat: 'Dev', foto_perfil: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carlos' }
  ];

  // FUNCIÓN MAESTRA ADAPTADA A RUTA BASE
  const apiCall = async (endpoint, method = 'GET', body = null) => {
    try {
      const options = { method, headers: { 'Content-Type': 'application/json' } };
      if (body) options.body = JSON.stringify(body);
      const res = await fetch(`${API_URL}${endpoint}`, options);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Error en servidor');
      return data;
    } catch (err) {
      if(method !== 'GET' && !endpoint.includes('search')) showToast(err.message, 'error');
      return null;
    }
  };

  // --- LÓGICA DE LATENCIA (COLD START) ---
  useEffect(() => {
    if (sessionStorage.getItem('whatsappx_server_awake')) return;
    
    let isMounted = true;
    
    const timer = setTimeout(() => {
      if (isMounted) setIsWakingUp(true);
    }, 1500);

    const baseUrl = API_URL ? API_URL.replace(/\/api\/?$/, '') : 'http://localhost:3000';
    
    fetch(`${baseUrl}/api/ping`)
      .then((res) => {
        if (res.ok && isMounted) {
          clearTimeout(timer);
          setIsWakingUp(false);
          sessionStorage.setItem('whatsappx_server_awake', 'true');
        }
      })
      .catch(() => console.log("Esperando respuesta del servidor (Cold Start)..."));

    return () => { 
      isMounted = false; 
      clearTimeout(timer); 
    };
  }, []);

  useEffect(() => {
    const storedUser = sessionStorage.getItem('whatsapp_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      const realName = parsedUser.name || parsedUser.nombre || '';
      setProfileData({
          displayName: realName + ' ' + parsedUser.apellido_pat,
          phone: parsedUser.num_Tel,
          status: parsedUser.puesto,
          photoURL: parsedUser.photoURL || ''
      });
      setView('chat');
      refreshUserProfile(parsedUser.num_Tel); 
    }
    setLoading(false);
    apiCall('/auth/departamentos').then(d => { if(d) setDepartamentos(d); });
  }, []);

  const refreshUserProfile = async (tel) => {
      if (tel === '0000000000') return;
      const res = await apiCall(`/auth/search?tel=${tel}`);
      if (res && res.found) {
          setUser(prevUser => {
              const updatedUser = { ...prevUser, ...res.data };
              sessionStorage.setItem('whatsapp_user', JSON.stringify(updatedUser));
              return updatedUser;
          });
          const realName = res.data.name || res.data.nombre || '';
          setProfileData(prev => ({ ...prev, displayName: realName + ' ' + res.data.apellido_pat, status: res.data.puesto, photoURL: res.data.photoURL || '' }));
      }
  };

  useEffect(() => {
    if (user) { 
        if (user.num_Tel === '0000000000') {
            setContacts(DEMO_CONTACTS);
            setChatList(DEMO_CHATS);
            if (activeChat?.id === 'chat_demo_1') setMessages(DEMO_MESSAGES_ANA);
            else if (activeChat?.id === 'group_demo_1') setMessages(DEMO_MESSAGES_GROUP);
            return; 
        }
        loadContacts(); 
        loadChats(); 
        if (activeChat) loadMessages(activeChat.id, activeChat.isGroup, false); 
        
        pollingInterval.current = setInterval(() => { 
            loadContacts(); 
            loadChats(true); 
            if (activeChat) {
                 loadMessages(activeChat.id, activeChat.isGroup, true);
                 apiCall('/messages/read', 'POST', { chatId: activeChat.id, userId: user.num_Tel });
            }
        }, 2000); 
    } else { 
        if (pollingInterval.current) clearInterval(pollingInterval.current); 
    } 
    return () => clearInterval(pollingInterval.current);
  }, [user, activeChat]);

  const loadGroupMembers = async () => { 
      if (activeChat && activeChat.isGroup) { 
          const res = await apiCall(`/chats/group/${activeChat.id}/members`); 
          if (res) setGroupMembers(res); 
      } 
  };

  useEffect(() => {
     if (activeChat) {
         if (user?.num_Tel === '0000000000' && activeChat.isGroup) {
             setGroupMembers(DEMO_GROUP_MEMBERS);
         } else if (activeChat.isGroup) { 
             loadGroupMembers(); 
         } else {
             const isKnownContact = contacts.some(c => c.num_Tel === activeChat.otherTel);
             if (!isKnownContact) {
                apiCall(`/auth/search?tel=${activeChat.otherTel}`).then(res => { 
                    if (res && res.found) setChatUser(res.data); 
                });
             }
         }
     }
  }, [activeChat, messages, chatUser, contacts, user]);

  const loadContacts = async () => { const data = await apiCall(`/chats/contacts/${user.num_Tel}`); if (data) setContacts(data); return data; };
  
  const loadChats = async (silent = false) => { 
      const data = await apiCall(`/chats/${user.num_Tel}`); 
      if (data) { 
          const validChats = data.filter(chat => { if (!chat.isGroup && chat.otherTel === user.num_Tel) return false; return true; }); 
          const enrichedChats = validChats.map(chat => { 
              if (chat.isGroup) return chat; 
              const contactMatch = contacts.find(c => c.num_Tel === chat.otherTel); 
              return { ...chat, photoURL: contactMatch ? contactMatch.photoURL : chat.photoURL }; 
          }); 
          setChatList(enrichedChats.sort((a,b) => b.timestamp - a.timestamp)); 
      } 
  };

  const loadMessages = async (chatId, isGroup, silent = false) => {
    const type = isGroup ? 'group' : 'individual';
    const data = await apiCall(`/messages/${chatId}?type=${type}`);
    if (data) {
        const processed = data.map(m => ({ ...m, isMe: m.senderId === user.num_Tel }));
        const lastMsgFromServer = processed.length > 0 ? processed[processed.length - 1] : null;
        const lastId = lastMsgFromServer ? lastMsgFromServer.id_msg : null;
        
        if (lastId !== lastProcessedMsgId.current) {
            setMessages(processed);
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
            if (silent && lastMsgFromServer && !lastMsgFromServer.isMe) NOTIFICATION_SOUND.play().catch(e => console.log("Audio error", e));
            lastProcessedMsgId.current = lastId;
        } else {
            setMessages(processed); 
        }
    }
  };

  const handleTranslate = async (msg, targetLangCode) => {
      setTranslateMenuMsgId(null); 
      const res = await apiCall('/messages/translate', 'POST', { 
          text: msg.contenido, 
          targetLang: targetLangCode,
          msgId: msg.id_msg, 
          chatType: activeChat.isGroup ? 'group' : 'individual'
      });

      if (res && res.translatedText) {
          setTranslationResult({
              original: msg.contenido,
              translated: res.translatedText,
              lang: TARGET_LANGUAGES.find(l => l.code === targetLangCode).name,
              flag: TARGET_LANGUAGES.find(l => l.code === targetLangCode).flag
          });
      }
  };

  const getCurrentChatUser = () => { 
      if (!activeChat) return null; 
      if (activeChat.isGroup) return { 
          nombre: activeChat.name, 
          photoURL: activeChat.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${activeChat.name}`, 
          num_Tel: 'Participantes varios', 
          puesto: 'Grupo', 
          departamento: 'N/A', 
          isGroup: true 
      }; 
      const contactMatch = contacts.find(c => c.num_Tel === activeChat.otherTel); 
      if (contactMatch) return contactMatch; 
      if (chatUser && chatUser.num_Tel) return chatUser; 
      return { 
          nombre: activeChat.name, 
          apellido_pat: '', 
          num_Tel: activeChat.otherTel || 'Desconocido', 
          puesto: 'Desconocido', 
          departamento: 'General', 
          photoURL: activeChat.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${activeChat.name}` 
      }; 
  };
  const activeUserDisplay = getCurrentChatUser();

  const handleLogin = async (e) => { e.preventDefault(); setLoading(true); const res = await apiCall('/auth/login', 'POST', { num_Tel: loginIdentifier, password }); setLoading(false); if (res && res.success) { sessionStorage.setItem('whatsapp_user', JSON.stringify(res.user)); setUser(res.user); const realName = res.user.name || res.user.nombre || ''; setProfileData({ displayName: realName + ' ' + res.user.apellido_pat, phone: res.user.num_Tel, status: res.user.puesto || 'Empleado', photoURL: res.user.photoURL || '' }); setView('chat'); } };
  
  const handleDemoLogin = async () => { 
      showToast("Conectando... Si el servidor estaba inactivo, tomará ~50s en despertar.", "success");
      setLoading(true); 
      
      const demoPhone = '0000000000'; 
      const demoPass = 'demo123';
      
      const res = await apiCall('/auth/login', 'POST', { num_Tel: demoPhone, password: demoPass }); 
      setLoading(false); 
      
      if (res && res.success) { 
          sessionStorage.setItem('whatsapp_user', JSON.stringify(res.user)); 
          setUser(res.user); 
          const realName = res.user.name || res.user.nombre || ''; 
          setProfileData({ displayName: realName + ' ' + res.user.apellido_pat, phone: res.user.num_Tel, status: res.user.puesto || 'Invitado', photoURL: res.user.photoURL || '' }); 
          setView('chat'); 
          setShowDemoWarning(true); 
      } else {
          showToast("Falta crear el usuario Demo en Oracle", "error");
      }
  };

  const handleLogout = () => { sessionStorage.removeItem('whatsapp_user'); setUser(null); setView('auth'); setActiveChat(null); setChatUser(null); lastProcessedMsgId.current = null; };
  
  const handleRegister = async (e) => { 
      e.preventDefault(); 
      const phoneRegex = /^[0-9]{10}$/;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; 
      
      if (!phoneRegex.test(regData.num_Tel)) return showToast("El teléfono debe tener 10 dígitos numéricos.", "error");
      if (!emailRegex.test(regData.correo)) return showToast("Correo electrónico inválido.", "error");

      setLoading(true); 
      const res = await apiCall('/auth/register', 'POST', regData); 
      setLoading(false); 
      if (res && res.success) { showToast("Registro exitoso."); setAuthMode('login'); } 
  };
  
  const handleStartChatFromContact = async (contact) => { if (contact.num_Tel === user.num_Tel) { showToast("No puedes iniciar un chat contigo mismo."); return; } const res = await apiCall('/chats/start', 'POST', { num_Tel1: user.num_Tel, num_Tel2: contact.num_Tel }); if (res && res.success) { lastProcessedMsgId.current = null; setMessages([]); setActiveChat({ ...res.chat, otherTel: contact.num_Tel }); setChatUser(contact); setView('chat'); } };
  
  const handleSelectChat = (chat) => { 
      if (activeChat?.id !== chat.id) { 
          lastProcessedMsgId.current = null; 
          setMessages([]); 
          setActiveChat(chat); 
          setChatUser(null);
          setIsSearchingChat(false);
          setChatSearchQuery('');
          apiCall('/messages/read', 'POST', { chatId: chat.id, userId: user.num_Tel });
      } 
  };
  
const handleDeleteChat = async () => { 
      if (!activeChat) return; 
      // CORTAFUEGOS DEMO
      if (user?.num_Tel === '0000000000') return showToast("Acción de borrado deshabilitada en modo Demo", "error");

      setConfirmDialog({
          isOpen: true,
          title: 'Eliminar chat',
          message: '¿Estás seguro de eliminar este chat por completo? Esta acción no se puede deshacer.',
          action: async () => {
              const res = await apiCall(`/chats/${activeChat.id}`, 'DELETE'); 
              if (res && res.success) { setActiveChat(null); setMessages([]); loadChats(); }
          }
      });
  };
  const handleSendMessage = async (type = 'text', content = null) => { if (!user || !activeChat) return; const textToSend = content || inputText; if (type === 'text' && !textToSend.trim()) return; const tempMsg = { id_msg: 'temp_' + Date.now(), contenido: type === 'text' ? textToSend : 'Enviando...', mediaContent: (type !== 'text') ? content : null, tipo_msg: type, hora_envio: new Date().toISOString(), isMe: true, status: 'enviado' }; setMessages(prev => [...prev, tempMsg]); setInputText(''); setShowAttachMenu(false); setShowEmojiPicker(false); await apiCall('/messages/send', 'POST', { senderId: user.num_Tel, chatId: activeChat.id, content: type === 'text' ? textToSend : 'Archivo adjunto', mediaContent: (type !== 'text') ? content : null, messageType: type, isGroup: activeChat.isGroup }); loadMessages(activeChat.id, activeChat.isGroup, false); loadChats(true); };
  
  const handleSearchContact = async () => { if (!searchPhone) return; if (searchPhone === user.num_Tel) { showToast("No puedes agregarte a ti mismo."); return; } setSearchResult(null); const res = await apiCall(`/auth/search?tel=${searchPhone}`); if (res && res.found) { if (res.data.num_Tel === user.num_Tel) { showToast("No puedes agregarte a ti mismo."); return; } setSearchResult(res.data); } else showToast("Empleado no encontrado"); };
  
  const confirmAddContact = async () => { if (!searchResult) return; const res = await apiCall('/chats/contact/add', 'POST', { ownerTel: user.num_Tel, contactTel: searchResult.num_Tel }); if (res && res.success) { showToast("Contacto agregado"); setSearchResult(null); setSearchPhone(''); loadContacts(); } };
  
const handleDeleteContact = async (contactTel) => { 
      // CORTAFUEGOS DEMO
      if (user?.num_Tel === '0000000000') return showToast("Acción de borrado deshabilitada en modo Demo", "error");

      setConfirmDialog({
          isOpen: true,
          title: 'Eliminar contacto',
          message: '¿Estás seguro de eliminar a este contacto de tu agenda?',
          action: async () => {
              const res = await apiCall('/chats/contact/remove', 'DELETE', { ownerTel: user.num_Tel, contactTel }); 
              if (res && res.success) loadContacts();
          }
      });
  };
  const createGroup = async () => { if (!groupName || selectedContacts.length === 0) return; const res = await apiCall('/chats/group/create', 'POST', { name: groupName, adminTel: user.num_Tel, members: selectedContacts.map(c => c.num_Tel) }); if(res && res.success) { showToast("Grupo creado"); setGroupName(''); setSelectedContacts([]); setView('chat'); loadChats(); } };
  
  const handleSaveProfile = async () => { 
      if (user.num_Tel === '0000000000') {
          const updatedUser = { ...user, nombre: profileData.displayName, name: profileData.displayName, photoURL: profileData.photoURL };
          setUser(updatedUser);
          sessionStorage.setItem('whatsapp_user', JSON.stringify(updatedUser));
          setView('chat');
          return showToast("Perfil actualizado (Simulado por seguridad en modo Demo)", "success");
      }

      const res = await apiCall('/auth/update-profile', 'PUT', { 
          num_Tel: user.num_Tel, displayName: profileData.displayName, 
          status: profileData.status, photoURL: profileData.photoURL 
      }); 
      if (res && res.success) { 
          showToast("Perfil actualizado", "success"); 
          refreshUserProfile(user.num_Tel); 
          setView('chat'); 
      } 
  };

  const handleChangePasswordSubmit = async () => {
      if (!passForm.actual || !passForm.nueva || !passForm.confirmar) return showToast("Llena todos los campos", "error");
      if (passForm.nueva !== passForm.confirmar) return showToast("Las contraseñas nuevas no coinciden", "error");
      
      setLoading(true); 

      if (user.num_Tel === '0000000000') {
          if (passForm.actual !== 'demo123') {
              setLoading(false);
              return showToast("Contraseña actual incorrecta", "error");
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          setLoading(false);
          setShowPasswordModal(false);
          setPassForm({ actual: '', nueva: '', confirmar: '' });
          setShowPassActual(false); setShowPassNueva(false); setShowPassConfirmar(false);
          return showToast("Contraseña actualizada (Simulado por seguridad)", "success");
      }

      const res = await apiCall('/auth/update-profile', 'PUT', { 
          num_Tel: user.num_Tel, displayName: profileData.displayName, 
          status: profileData.status, photoURL: profileData.photoURL, password: passForm.nueva 
      }); 
      
      setLoading(false); 
      
      if (res && res.success) {
          showToast("Contraseña actualizada exitosamente", "success");
          setShowPasswordModal(false);
          setPassForm({ actual: '', nueva: '', confirmar: '' });
          setShowPassActual(false); setShowPassNueva(false); setShowPassConfirmar(false);
      } else {
          showToast(res?.error || "Error al conectar con la base de datos", "error");
      }
  };
  
  const handleProfileImageChange = async (e) => { const file = e.target.files[0]; if (!file) return; const compressed = await compressImage(file); setProfileData(prev => ({ ...prev, photoURL: compressed })); };
  
  const handleGroupImageChange = async (e) => { const file = e.target.files[0]; if (!file || !activeChat || !activeChat.isGroup) return; const compressed = await compressImage(file); const res = await apiCall('/chats/group/profile', 'PUT', { groupId: activeChat.id, photoURL: compressed }); if (res && res.success) { showToast("Foto grupo actualizada"); loadChats(); setActiveChat(prev => ({ ...prev, photoURL: compressed })); } };
  
  const handleFileUpload = async (e) => { const file = e.target.files[0]; if (!file) return; let content = null; let type = 'text'; if (file.type.startsWith('image/')) { type = 'image'; content = await compressImage(file); } else if (file.type.startsWith('video/')) { type = 'video'; content = await fileToBase64(file); } else { type = 'document'; content = await fileToBase64(file); } if (content) handleSendMessage(type, content); else showToast("Error archivo."); };
  
  const startRecording = async () => { try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); mediaRecorderRef.current = new MediaRecorder(stream); audioChunksRef.current = []; mediaRecorderRef.current.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); }; mediaRecorderRef.current.onstop = () => { const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); const reader = new FileReader(); reader.readAsDataURL(blob); reader.onloadend = () => handleSendMessage('audio', reader.result); }; mediaRecorderRef.current.start(); setIsRecording(true); } catch (e) { showToast("Micrófono no disponible"); console.error(e); } };
  const stopRecording = () => { if(mediaRecorderRef.current) { mediaRecorderRef.current.stop(); setIsRecording(false); } };
  const addEmoji = (emoji) => { setInputText(prev => prev + emoji); };
  
  const handleAddMemberToGroup = async (contact) => { if (!activeChat || !activeChat.isGroup) return; const res = await apiCall(`/chats/group/${activeChat.id}/members`, 'POST', { memberTel: contact.num_Tel }); if (res && res.success) { loadGroupMembers(); showToast(`${contact.name || contact.nombre} añadido.`); } else { showToast("Error."); } };
  
const handleRemoveMemberFromGroup = async (memberTel) => { 
      if (!activeChat || !activeChat.isGroup) return; 
      // CORTAFUEGOS DEMO
      if (user?.num_Tel === '0000000000') return showToast("Acción de borrado deshabilitada en modo Demo", "error");

      const memberToRemove = groupMembers.find(m => m.num_Tel === memberTel); 
      const memberName = memberToRemove ? (memberToRemove.name || memberToRemove.nombre) : 'Usuario'; 
      
      setConfirmDialog({
          isOpen: true,
          title: 'Expulsar del grupo',
          message: `¿Estás seguro de eliminar a ${memberName} de este grupo?`,
          action: async () => {
              const res = await apiCall(`/chats/group/${activeChat.id}/members/${memberTel}`, 'DELETE'); 
              if (res && res.success) { loadGroupMembers(); showToast(`${memberName} eliminado.`); }
          }
      });
  };
  if (loading) return <div className="h-screen bg-[#111b21] flex items-center justify-center text-white">Cargando...</div>;

  if (view === 'auth') { 
      return (
          <div className="min-h-screen bg-[#111b21] flex items-center justify-center p-4 font-sans text-[#e9edef]">
              <div className="w-full max-w-md bg-[#202c33] p-8 rounded-xl shadow-2xl border border-[#2f3b43]">
                  <div className="text-center mb-6">
                      <h1 className="text-2xl font-bold text-[#00a884]">WhatsApp X</h1>
                  </div>
                  
                  {/* FORMULARIO ÚNICO DE LOGIN */}
                  <form onSubmit={handleLogin} className="space-y-4">
                      <input 
                          type="tel" 
                          placeholder="Teléfono" 
                          className="w-full p-3 bg-[#2a3942] rounded outline-none text-[#e9edef]" 
                          value={loginIdentifier} 
                          onChange={e=>setLoginIdentifier(e.target.value)} 
                          required
                      />
                      
                      {/* CONTENEDOR RELATIVO PARA EL OJITO */}
                      <div className="relative">
                          <input 
                              type={showLoginPass ? "text" : "password"} 
                              placeholder="Contraseña" 
                              className="w-full p-3 bg-[#2a3942] rounded outline-none text-[#e9edef] pr-10" 
                              value={password} 
                              onChange={e=>setPassword(e.target.value)} 
                              required
                          />
                          <button 
                              type="button"
                              onClick={() => setShowLoginPass(!showLoginPass)} 
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#8696a0] hover:text-[#00a884] transition-colors"
                          >
                              {showLoginPass ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                      </div>

                      <button className="w-full bg-[#00a884] text-[#111b21] font-bold p-3 rounded hover:bg-[#008f6f] transition-colors">
                          {loading ? 'Entrando...' : 'Iniciar Sesión'}
                      </button>
                  </form>
                  
                  {/* LEYENDA Y BOTÓN DEMO */}
                  <div className="mt-6 border-t border-[#2f3b43] pt-4 text-center">
                      <p className="text-xs text-[#8696a0] mb-4">Chat privado solo para empleados, si tienes un problema contacta con los administradores.</p>
                      
                      <button onClick={handleDemoLogin} disabled={loading} className="w-full bg-transparent border border-[#00a884] text-[#00a884] font-bold p-3 rounded hover:bg-[#00a884] hover:text-[#111b21] transition-colors flex items-center justify-center gap-2">
                          <User size={18} /> Probar Demo
                      </button>
                  </div>
              </div>
          </div>
      ); 
  }
  
  if (view === 'contacts') { return <div className="min-h-screen bg-[#111b21] flex flex-col font-sans text-[#e9edef]"><div className="h-16 bg-[#202c33] flex items-center px-4 gap-4 border-b border-[#2f3b43]"><button onClick={()=>setView('chat')}><ArrowLeft size={24}/></button><h2 className="text-xl font-medium">Mis Contactos</h2></div><div className="p-4 max-w-lg mx-auto w-full space-y-6"><div className="bg-[#202c33] p-4 rounded-lg space-y-4"><h3 className="text-[#00a884] font-bold">Agregar Nuevo Contacto</h3><div className="flex gap-2"><input type="tel" placeholder="Buscar teléfono..." className="flex-1 p-2 bg-[#111b21] rounded outline-none" value={searchPhone} onChange={e=>setSearchPhone(e.target.value)}/><button onClick={handleSearchContact} className="bg-[#00a884] p-2 rounded"><Search size={20}/></button></div>{searchResult && <div className="bg-[#111b21] p-2 mt-2 flex justify-between items-center rounded border border-[#00a884]"><span className="text-sm">{searchResult.name} {searchResult.apellido_pat}</span><button onClick={confirmAddContact} className="text-xs bg-[#00a884] px-2 py-1 rounded text-black font-bold">Agregar</button></div>}</div><div className="space-y-2"><h3 className="text-[#8696a0] text-sm uppercase">Tus amigos registrados</h3>{contacts.map((c,i)=>(<div key={i} className="flex items-center justify-between p-3 hover:bg-[#202c33] border-b border-[#2f3b43] cursor-pointer"><div className="flex items-center flex-1" onClick={()=>handleStartChatFromContact(c)}><img src={c.photoURL||`https://api.dicebear.com/7.x/initials/svg?seed=${c.num_Tel}`} className="w-12 h-12 rounded-full bg-gray-500 mr-3"/><div><p className="font-bold">{c.name} {c.apellido_pat}</p><p className="text-xs text-gray-400">{c.puesto}</p></div></div><button onClick={()=>handleDeleteContact(c.num_Tel)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-full"><Trash2 size={18}/></button></div>))}</div></div></div>; }
  
  if (view === 'profile') { 
    return (
      <div className="min-h-screen bg-[#111b21] flex flex-col font-sans text-[#e9edef]">
        <div className="h-16 bg-[#202c33] flex items-center px-4 gap-4 border-b border-[#2f3b43]">
          <button onClick={()=>setView('chat')}><ArrowLeft size={24}/></button>
          <h2 className="text-xl font-medium">Perfil</h2>
        </div>
        <div className="p-8 max-w-md mx-auto w-full space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <img src={profileData.photoURL||`https://api.dicebear.com/7.x/initials/svg?seed=${user?.num_Tel}`} className="w-32 h-32 rounded-full border-2 border-[#00a884] object-cover"/>
              <label className="absolute bottom-0 right-0 bg-[#00a884] p-2 rounded-full cursor-pointer hover:bg-[#008f6f]">
                <Camera size={20} className="text-white"/>
                <input type="file" className="hidden" accept="image/*" onChange={handleProfileImageChange}/>
              </label>
            </div>
          </div>
          <div className="space-y-4">
            
            <div>
              <label className="text-[#00a884] text-sm font-bold">Nombre</label>
              <div className="flex items-center bg-[#202c33] p-3 rounded mt-1">
                <User size={20} className="text-gray-400 mr-3"/>
                <input type="text" className="bg-transparent w-full outline-none" value={profileData.displayName} onChange={e => setProfileData({...profileData, displayName: e.target.value})} />
              </div>
            </div>
            
            <div className="pt-2">
                <button onClick={() => setShowPasswordModal(true)} className="w-full bg-transparent border border-[#00a884] text-[#00a884] font-bold p-3 rounded hover:bg-[#00a884] hover:text-[#111b21] transition-colors flex items-center justify-center gap-2">
                    <Edit2 size={20}/> Cambiar Contraseña
                </button>
                {user?.num_Tel === '0000000000' && (
                    <p className="text-xs text-center text-[#8696a0] mt-3">
                        💡 Tip para Reclutadores: La contraseña actual es <span className="text-[#00a884] font-bold">demo123</span>
                    </p>
                )}
            </div>

            <div>
              <label className="text-[#00a884] text-sm font-bold">Puesto</label>
              <div className="flex items-center bg-[#202c33] p-3 rounded mt-1 opacity-50">
                <Info size={20} className="text-gray-400 mr-3"/>
                <input type="text" className="bg-transparent w-full outline-none" value={profileData.status} disabled/>
              </div>
            </div>
            <div>
              <label className="text-[#00a884] text-sm font-bold">Departamento</label>
              <div className="flex items-center bg-[#202c33] p-3 rounded mt-1 opacity-50">
                <Users size={20} className="text-gray-400 mr-3"/>
                <input type="text" className="bg-transparent w-full outline-none" value={user?.departamento||'General'} disabled/>
              </div>
            </div>
            <div>
              <label className="text-[#00a884] text-sm font-bold">Teléfono</label>
              <div className="flex items-center bg-[#202c33] p-3 rounded mt-1 opacity-50">
                <Phone size={20} className="text-gray-400 mr-3"/>
                <input type="text" className="bg-transparent w-full outline-none" value={profileData.phone} disabled/>
              </div>
            </div>
            
            <button onClick={handleSaveProfile} className="w-full bg-[#00a884] text-[#111b21] font-bold p-3 rounded flex items-center justify-center gap-2 hover:bg-[#008f6f]">
              <Save size={20}/> Guardar Cambios
            </button>
            
          </div>
        </div>

        {/* MODAL DE CAMBIO DE CONTRASEÑA */}
        {showPasswordModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
                <div className="bg-[#202c33] p-6 rounded-lg max-w-sm w-full border border-[#2f3b43] shadow-2xl relative">
                    <button 
                        onClick={() => { 
                            setShowPasswordModal(false); 
                            setPassForm({actual: '', nueva: '', confirmar: ''}); 
                            setShowPassActual(false); 
                            setShowPassNueva(false); 
                            setShowPassConfirmar(false); 
                        }} 
                        className="absolute top-3 right-3 text-gray-400 hover:text-white"
                    >
                        <X size={20}/>
                    </button>
                    <h3 className="text-[#00a884] font-bold text-lg mb-6 flex items-center gap-2"><Edit2 size={20}/> Cambiar Contraseña</h3>
                    
                    <div className="space-y-4">
                        {/* CONTRASEÑA ACTUAL */}
                        <div>
                            <label className="text-xs text-[#8696a0] uppercase font-bold">Contraseña Actual</label>
                            <div className="relative mt-1">
                                <input 
                                    type={showPassActual ? "text" : "password"} 
                                    value={passForm.actual} 
                                    onChange={e => setPassForm({...passForm, actual: e.target.value})} 
                                    className="w-full p-3 bg-[#111b21] rounded outline-none border border-[#2f3b43] text-sm text-[#e9edef] pr-10"
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassActual(!showPassActual)} 
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#8696a0] hover:text-[#00a884] transition-colors"
                                >
                                    {showPassActual ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* NUEVA CONTRASEÑA */}
                        <div>
                            <label className="text-xs text-[#8696a0] uppercase font-bold">Nueva Contraseña</label>
                            <div className="relative mt-1">
                                <input 
                                    type={showPassNueva ? "text" : "password"} 
                                    value={passForm.nueva} 
                                    onChange={e => setPassForm({...passForm, nueva: e.target.value})} 
                                    className="w-full p-3 bg-[#111b21] rounded outline-none border border-[#2f3b43] text-sm text-[#e9edef] pr-10"
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassNueva(!showPassNueva)} 
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#8696a0] hover:text-[#00a884] transition-colors"
                                >
                                    {showPassNueva ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* CONFIRMAR NUEVA CONTRASEÑA */}
                        <div>
                            <label className="text-xs text-[#8696a0] uppercase font-bold">Confirmar Nueva Contraseña</label>
                            <div className="relative mt-1">
                                <input 
                                    type={showPassConfirmar ? "text" : "password"} 
                                    value={passForm.confirmar} 
                                    onChange={e => setPassForm({...passForm, confirmar: e.target.value})} 
                                    className="w-full p-3 bg-[#111b21] rounded outline-none border border-[#2f3b43] text-sm text-[#e9edef] pr-10"
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassConfirmar(!showPassConfirmar)} 
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#8696a0] hover:text-[#00a884] transition-colors"
                                >
                                    {showPassConfirmar ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        
                        <button 
                            onClick={handleChangePasswordSubmit} 
                            disabled={loading}
                            className="w-full bg-[#00a884] text-[#111b21] font-bold py-3 rounded mt-4 hover:bg-[#008f6f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Conectando a Oracle...' : 'Confirmar Cambio'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {toast && (
            <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-[99999] animate-bounce">
                <div className={`px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 text-sm font-bold text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-[#00a884]'}`}>
                    {toast.type === 'error' ? <X size={18} /> : <Check size={18} />}
                    {toast.message}
                </div>
            </div>
        )}

      </div>
    ); 
  }
  
  if (view === 'newGroup') { return <div className="min-h-screen bg-[#111b21] flex flex-col font-sans text-[#e9edef]"><div className="h-16 bg-[#202c33] flex items-center px-4 gap-4 border-b border-[#2f3b43]"><button onClick={()=>setView('chat')}><ArrowLeft size={24}/></button><h2 className="text-xl font-medium">Nuevo Grupo</h2></div><div className="p-4 max-w-lg mx-auto w-full space-y-6"><div className="bg-[#202c33] p-4 rounded-lg"><input type="text" placeholder="Nombre del grupo" className="w-full p-3 bg-[#111b21] rounded outline-none border-b-2 border-[#00a884]" value={groupName} onChange={e=>setGroupName(e.target.value)}/></div><div className="space-y-2"><h3 className="text-[#8696a0] text-sm uppercase mb-2">Seleccionar Participantes</h3>{contacts.map(c=>(<div key={c.num_Tel} onClick={()=>{if(selectedContacts.find(sc=>sc.num_Tel===c.num_Tel))setSelectedContacts(prev=>prev.filter(sc=>sc.num_Tel!==c.num_Tel));else setSelectedContacts(prev=>[...prev,c]);}} className={`flex items-center p-3 cursor-pointer border rounded-lg ${selectedContacts.find(sc=>sc.num_Tel===c.num_Tel)?'border-[#00a884] bg-[#005c4b]/20':'border-transparent hover:bg-[#202c33]'}`}><div className={`w-5 h-5 rounded border mr-3 flex items-center justify-center ${selectedContacts.find(sc=>sc.num_Tel===c.num_Tel)?'bg-[#00a884] border-[#00a884]':'border-gray-500'}`}>{selectedContacts.find(sc=>sc.num_Tel===c.num_Tel)&&<CheckCheck size={14} className="text-white"/>}</div><img src={c.photoURL||`https://api.dicebear.com/7.x/initials/svg?seed=${c.num_Tel}`} className="w-10 h-10 rounded-full mr-3"/><p>{c.name} {c.apellido_pat}</p></div>))}</div><button onClick={createGroup} disabled={!groupName||selectedContacts.length===0} className={`w-full font-bold p-3 rounded ${!groupName||selectedContacts.length===0?'bg-gray-600 text-gray-400':'bg-[#00a884] text-[#111b21] hover:bg-[#008f6f]'}`}>Crear Grupo</button></div></div>; }
  
if (view === 'contactInfo') { 
    const displayUser = activeUserDisplay; 
    if (!displayUser) return null; 
    const isGroup = displayUser.isGroup; 
    
    return (
      <div className="min-h-screen bg-[#111b21] flex flex-col font-sans text-[#e9edef]">
        
        {/* CABECERA */}
        <div className="h-16 bg-[#202c33] flex items-center px-4 gap-4 border-b border-[#2f3b43]">
          <button onClick={()=>setView('chat')}><ArrowLeft size={24}/></button>
          <h2 className="text-xl font-medium">{isGroup ? 'Info. del Grupo' : 'Info. del Contacto'}</h2>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="flex flex-col items-center p-8 gap-4">
          <div className="relative group">
            <img src={displayUser.photoURL} className="w-40 h-40 rounded-full border-4 border-[#202c33] shadow-lg object-cover"/>
            {isGroup && (
              <label className="absolute bottom-0 right-0 bg-[#00a884] p-2 rounded-full cursor-pointer hover:bg-[#008f6f]">
                <Camera size={20} className="text-white"/>
                <input type="file" className="hidden" accept="image/*" onChange={handleGroupImageChange}/>
              </label>
            )}
          </div>
          
          <h2 className="text-2xl font-bold text-center">{displayUser.name||displayUser.nombre} {displayUser.apellido_pat}</h2>
          {!isGroup && <p className="text-[#8696a0] text-lg">{displayUser.num_Tel}</p>}
          
          <div className="w-full max-w-md bg-[#202c33] rounded-lg p-4 mt-4 space-y-4">
            
            <div className="flex items-center gap-4 text-[#00a884]">
              <Briefcase/>
              <div>
                <p className="text-sm text-[#8696a0]">{isGroup ? 'Tipo' : 'Puesto'}</p>
                <p className="font-medium text-white">{displayUser.puesto||'Empleado'}</p>
              </div>
            </div>
            
            {!isGroup && (
              <div className="flex items-center gap-4 text-[#00a884]">
                <Users/>
                <div>
                  <p className="text-sm text-[#8696a0]">Departamento</p>
                  <p className="font-medium text-white">{displayUser.departamento||'General'}</p>
                </div>
              </div>
            )}
            
            {!isGroup && (
              <div className="flex items-center gap-4 text-[#00a884]">
                <Phone/>
                <div>
                  <p className="text-sm text-[#8696a0]">Teléfono</p>
                  <p className="font-medium text-white">{displayUser.num_Tel}</p>
                </div>
              </div>
            )}
            
            {/* SECCIÓN DE PARTICIPANTES DEL GRUPO */}
            {isGroup && (
              <div className="pt-2 border-t border-[#2f3b43]">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-[#00a884] text-sm font-bold flex items-center gap-2"><Users size={16}/> {groupMembers.length} Participantes</p>
                  <button onClick={()=>setShowAddMember(!showAddMember)} className="text-xs bg-[#202c33] border border-[#00a884] text-[#00a884] px-2 py-1 rounded hover:bg-[#00a884] hover:text-[#111b21] transition">{showAddMember ? 'Cerrar' : '+ Añadir'}</button>
                </div>
                
                {showAddMember && (
                  <div className="mb-3 p-2 bg-[#111b21] rounded border border-[#2f3b43] max-h-40 overflow-y-auto">
                    <p className="text-xs text-gray-500 mb-2 uppercase">Contactos disponibles</p>
                    {contacts.filter(c=>!groupMembers.some(m=>m.num_Tel===c.num_Tel)).map(c=>(
                      <div key={c.num_Tel} onClick={()=>handleAddMemberToGroup(c)} className="flex items-center justify-between p-2 hover:bg-[#202c33] cursor-pointer rounded">
                        <div className="flex items-center gap-2">
                          <img src={c.photoURL} className="w-6 h-6 rounded-full"/>
                          <span className="text-sm">{c.name}</span>
                        </div>
                        <Plus size={14} className="text-[#00a884]"/>
                      </div>
                    ))}
                    {contacts.filter(c=>!groupMembers.some(m=>m.num_Tel===c.num_Tel)).length===0 && <p className="text-xs text-center p-2">No hay más contactos para añadir</p>}
                  </div>
                )}
                
                <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                  {groupMembers.map((m,idx)=>(
                    <div key={idx} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <img src={m.photoURL||`https://api.dicebear.com/7.x/initials/svg?seed=${m.num_Tel}`} className="w-10 h-10 rounded-full bg-gray-600"/>
                        <div>
                          <p className="font-medium text-sm">{m.name||m.nombre} {m.apellido_pat}</p>
                          <p className="text-xs text-[#8696a0]">{m.num_Tel}</p>
                        </div>
                      </div>
                      <button onClick={()=>handleRemoveMemberFromGroup(m.num_Tel)} className="md:opacity-0 md:group-hover:opacity-100 opacity-100 p-2 text-red-500 hover:bg-red-500/10 rounded-full transition"><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {confirmDialog.isOpen && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[99999] p-4">
                <div className="bg-[#202c33] p-6 rounded-lg max-w-sm w-full border border-[#2f3b43] shadow-2xl relative">
                    <h3 className="text-[#e9edef] font-bold text-lg mb-2">{confirmDialog.title}</h3>
                    <p className="text-[#8696a0] mb-8 text-sm">{confirmDialog.message}</p>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} className="px-4 py-2 text-[#00a884] hover:bg-[#2a3942] rounded font-medium transition-colors">Cancelar</button>
                        <button onClick={async () => { if (confirmDialog.action) { await confirmDialog.action(); } setConfirmDialog({ ...confirmDialog, isOpen: false }); }} className="px-4 py-2 bg-[#ef4444] text-[#111b21] rounded font-bold hover:bg-[#dc2626] transition-colors">Eliminar</button>
                    </div>
                </div>
            </div>
        )}

      </div>
    ); 
  }

  return (
    <div className="flex h-screen bg-[#0b141a] text-[#e9edef] overflow-hidden font-sans">

    {/* --- LETRERO DE LATENCIA (COLD START) --- */}
      {isWakingUp && (
        <div style={{ 
          backgroundColor: '#f59e0b', 
          color: 'white', 
          textAlign: 'center', 
          padding: '12px', 
          fontWeight: 'bold', 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100%', 
          zIndex: 9999, 
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)' 
        }}>
          ⏳ Reiniciando servidor por inactividad, esto tomará un minuto...
        </div>
      )}

      {/* VISOR MULTIMEDIA A PANTALLA COMPLETA */}
      {mediaViewer && (
          <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-[200]">
              {/* Botones superiores */}
              <div className="absolute top-4 right-4 flex gap-4">
                  <a href={mediaViewer.mediaContent} download={`media_${mediaViewer.id_msg}`} className="bg-[#00a884] text-[#111b21] px-4 py-2 rounded font-bold hover:bg-[#008f6f] flex items-center gap-2">
                      Descargar
                  </a>
                  <button onClick={() => setMediaViewer(null)} className="bg-[#202c33] text-white p-2 rounded hover:bg-red-600 transition-colors">
                      <X size={24}/>
                  </button>
              </div>
              
              {/* Contenedor de la imagen o video en grande */}
              {mediaViewer.tipo_msg === 'image' && <img src={mediaViewer.mediaContent} className="max-w-full max-h-[85vh] object-contain shadow-2xl" />}
              {mediaViewer.tipo_msg === 'video' && <video src={mediaViewer.mediaContent} controls autoPlay className="max-w-full max-h-[85vh] shadow-2xl" />}
          </div>
      )}
      
      {/* NOTIFICACIONES TOAST PROFESIONALES */}
      {toast && (
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-[100] animate-bounce">
          <div className={`px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 text-sm font-bold text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-[#00a884]'}`}>
            {toast.type === 'error' ? <X size={18} /> : <Check size={18} />}
            {toast.message}
          </div>
        </div>
      )}

      {/* MODAL DE RESULTADO DE TRADUCCIÓN */}
      {translationResult && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#202c33] p-6 rounded-lg max-w-md w-full border border-[#00a884] shadow-2xl relative">
                <button onClick={() => setTranslationResult(null)} className="absolute top-2 right-2 text-gray-400 hover:text-white"><X/></button>
                <h3 className="text-[#00a884] font-bold text-lg mb-4 flex items-center gap-2">
                    <Globe size={20}/> Traducción al {translationResult.lang} {translationResult.flag}
                </h3>
                
                <div className="mb-4">
                    <p className="text-xs text-[#8696a0] uppercase mb-1">Original</p>
                    <div className="p-3 bg-[#111b21] rounded text-sm italic border-l-2 border-gray-600">
                        "{translationResult.original}"
                    </div>
                </div>

                <div>
                    <p className="text-xs text-[#8696a0] uppercase mb-1">Traducido</p>
                    <div className="p-3 bg-[#0b141a] rounded text-lg font-medium text-white border-l-4 border-[#00a884]">
                        {translationResult.translated}
                    </div>
                </div>
                
                <button onClick={() => setTranslationResult(null)} className="mt-6 w-full bg-[#00a884] text-black font-bold py-2 rounded hover:bg-[#008f6f]">
                    Entendido
                </button>
            </div>
        </div>
      )}

      {/* PANEL IZQUIERDO: LISTA DE CHATS */}
      <div className={`w-full md:w-[400px] border-r border-[#2f3b43] flex flex-col ${activeChat && 'hidden md:flex'}`}>
         <div className="h-16 bg-[#202c33] flex items-center justify-between px-4 border-b border-[#2f3b43]"><div className="flex items-center gap-3"><img src={user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.num_Tel}`} className="w-10 h-10 rounded-full bg-white cursor-pointer hover:opacity-80 object-cover" onClick={() => setView('profile')} title="Mi Perfil" /><p className="font-bold text-sm truncate w-24">{user.nombre}</p></div><div className="flex gap-4 text-[#aebac1]"><button onClick={() => setView('contacts')}><Users size={20}/></button><button onClick={() => setView('newGroup')}><Plus size={20}/></button><button onClick={handleLogout}><LogOut size={20}/></button></div></div>
         
         {/* BUSCADOR */}
         <div className="p-2 bg-[#111b21]">
             <div className="flex items-center bg-[#202c33] rounded-lg px-3 py-1.5">
                 <Search size={18} className="text-[#aebac1] mr-3" />
                 <input 
                    type="text" 
                    placeholder="Busca un chat..." 
                    value={mainMenuSearch}
                    onChange={(e) => setMainMenuSearch(e.target.value)}
                    className="bg-transparent w-full focus:outline-none text-sm text-[#d1d7db]" 
                 />
             </div>
         </div>
         {/* LISTA DE CHATS CON FILTRO APLICADO */}
         <div className="flex-1 overflow-y-auto custom-scrollbar">
             {chatList
                .filter(chat => normalizeText(chat.name).includes(normalizeText(mainMenuSearch)))
                .map(chat => (
                <div key={chat.id} onClick={() => handleSelectChat(chat)} className={`flex items-center p-3 cursor-pointer hover:bg-[#202c33] border-b border-[#2f3b43] ${activeChat?.id === chat.id ? 'bg-[#2a3942]' : ''}`}>
                     <img src={chat.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${chat.name}`} className="w-12 h-12 rounded-full bg-gray-600 mr-3 object-cover"/>
                     <div className="flex-1 overflow-hidden">
                         <div className="flex justify-between">
                             <h3 className="font-normal truncate">{chat.name}</h3>
                             <span className="text-xs text-[#8696a0]">{chat.lastTime}</span>
                         </div>
                         <p className="text-sm text-[#8696a0] truncate">{chat.lastMessage}</p>
                     </div>
                 </div>
             ))}
         </div>
      </div>

      {/* PANEL DERECHO: CONVERSACIÓN */}
      {activeChat ? (
        <div className="flex-1 flex flex-col bg-[#0b141a] relative w-full">
          <div className="h-16 bg-[#202c33] flex items-center px-4 shadow-sm z-10 border-b border-[#2f3b43] gap-3">
             <button className="md:hidden" onClick={() => setActiveChat(null)}><ArrowLeft/></button>
             <div className="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center text-white cursor-pointer overflow-hidden" onClick={() => setView('contactInfo')}>
                 <img src={activeUserDisplay?.photoURL || activeChat.photoURL} className="w-full h-full object-cover"/>
             </div>
             <div className="flex-1 cursor-pointer" onClick={() => setView('contactInfo')}><h3 className="font-medium">{activeChat.name}</h3><p className="text-xs text-[#8696a0]">{activeChat.isGroup ? 'Grupo' : (activeUserDisplay?.puesto || 'Disponible')}</p></div>

             <div className="flex gap-4 text-[#aebac1] relative">
                 <button onClick={() => setShowChatMenu(!showChatMenu)} className="p-2 hover:bg-[#202c33] rounded-full transition-colors">
                     <MoreVertical size={20} />
                 </button>
                 
                 {showChatMenu && (
                     <div className="absolute top-12 right-0 bg-[#233138] border border-[#2f3b43] rounded shadow-2xl z-50 w-48 py-2">
                         <button onClick={() => { setShowChatMenu(false); setIsSearchingChat(true); }} className="w-full text-left px-4 py-3 text-sm hover:bg-[#111b21] flex items-center gap-3 text-[#d1d7db]">
                             <Search size={18} /> Buscar
                         </button>
                         <button onClick={() => { setShowChatMenu(false); handleDeleteChat(); }} className="w-full text-left px-4 py-3 text-sm hover:bg-[#111b21] text-red-400 flex items-center gap-3">
                             <Trash2 size={18} /> Eliminar chat
                         </button>
                     </div>
                 )}
             </div>
                       </div>
          
          {isSearchingChat && (
              <div className="bg-[#202c33] p-2 flex items-center gap-2 border-b border-[#2f3b43] z-10 relative">
                  <button onClick={() => { setIsSearchingChat(false); setChatSearchQuery(''); }} className="p-2 text-[#8696a0] hover:text-white transition-colors">
                      <ArrowLeft size={20} />
                  </button>
                  <div className="flex-1 bg-[#2a3942] rounded-lg flex items-center px-4 py-1.5">
                      <input 
                          type="text" 
                          placeholder="Buscar mensaje..." 
                          className="bg-transparent w-full outline-none text-[#d1d7db] text-sm"
                          value={chatSearchQuery}
                          onChange={(e) => setChatSearchQuery(e.target.value)}
                          autoFocus
                      />
                  </div>
              </div>
          )}

          <div className="absolute inset-0 opacity-5 pointer-events-none" style={{backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')"}}></div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2 z-0 relative">
             {messages.filter(msg => {
                 if (!chatSearchQuery) return true;   
                 if (msg.tipo_msg !== 'text') return false; 
                 return normalizeText(msg.contenido).includes(normalizeText(chatSearchQuery));
             }).map((msg, idx) => (
                 <div key={idx} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'} mb-2`}>
                   <div className={`max-w-[80%] rounded-lg p-2 shadow-sm relative group ${msg.isMe ? 'bg-[#005c4b]' : 'bg-[#202c33]'}`}>
                     
                     {activeChat.isGroup && !msg.isMe && (
                        <p className="text-[10px] font-bold text-[#e542a3] mb-1">{msg.senderName}</p>
                     )}

                     {msg.tipo_msg === 'image' && <img src={msg.mediaContent} onClick={() => setMediaViewer(msg)} className="rounded-lg max-h-64 object-cover mb-1 cursor-pointer hover:opacity-80 transition-opacity"/>}
                     {msg.tipo_msg === 'video' && <video src={msg.mediaContent} onClick={() => setMediaViewer(msg)} className="rounded-lg max-h-64 mb-1 cursor-pointer hover:opacity-80 transition-opacity" />}
                     {msg.tipo_msg === 'audio' && <audio src={msg.mediaContent} controls className="mb-1 w-64" />}
                     {msg.tipo_msg === 'document' && (
                        <a href={msg.mediaContent} download={`archivo_${msg.id_msg}.pdf`} className="flex items-center gap-2 bg-black/20 p-3 rounded mb-1 hover:bg-black/30 transition-colors text-white">
                            <FileText size={24} />
                            <span className="underline text-sm">Descargar Documento</span>
                        </a>
                     )}
                     
                     {msg.tipo_msg === 'text' && <div className="px-1 text-sm text-[#e9edef]">{msg.contenido}</div>}
                     
                     <div className="flex justify-end gap-1 items-center mt-1">
                         <span className="text-[10px] text-[#8696a0]">{msg.hora_envio ? new Date(msg.hora_envio).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}</span>
                         
                         {msg.isMe && (
                             <span className="ml-1" title={msg.status}>
                                {msg.status === 'visto' ? <CheckCheck size={14} className="text-[#53bdeb]"/> : <Check size={14} className="text-[#8696a0]"/>}
                             </span>
                         )}

                         {!msg.isMe && msg.tipo_msg === 'text' && (
                             <div className="relative">
                                 <button onClick={() => setTranslateMenuMsgId(translateMenuMsgId === msg.id_msg ? null : msg.id_msg)} title="Traducir" className="ml-1 opacity-60 hover:opacity-100 hover:text-[#00a884] transition">
                                     <Globe size={12}/>
                                 </button>
                                 
                                 {translateMenuMsgId === msg.id_msg && (
                                     <>
                                       <div className="fixed inset-0 bg-black/60 z-[90]" onClick={() => setTranslateMenuMsgId(null)}></div>
                                       
                                       <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#233138] border border-[#00a884] rounded-lg shadow-2xl z-[100] w-64 p-3">
                                           <p className="text-xs text-[#00a884] font-bold uppercase mb-3 px-2 text-center border-b border-[#2f3b43] pb-2">¿A qué idioma traducir?</p>
                                           <div className="grid grid-cols-2 gap-2">
                                             {TARGET_LANGUAGES.map(lang => (
                                                 <button 
                                                    key={lang.code} 
                                                    onClick={() => handleTranslate(msg, lang.code)}
                                                    className="w-full text-center px-2 py-3 text-sm hover:bg-[#111b21] border border-transparent hover:border-[#2f3b43] rounded-lg flex flex-col items-center gap-1 transition-all"
                                                 >
                                                     <span className="text-2xl">{lang.flag}</span> 
                                                     <span className="text-xs text-[#d1d7db] mt-1">{lang.name}</span>
                                                 </button>
                                             ))}
                                           </div>
                                       </div>
                                     </>
                                 )}
                             </div>
                         )}
                     </div>
                   </div>
                 </div>
             ))}
             <div ref={scrollRef}/>
          </div>
          
          <div className="bg-[#202c33] p-2 flex items-end gap-2 z-10 relative">
             <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} disabled={user?.num_Tel === '0000000000'} />
             
             {showEmojiPicker && user?.num_Tel !== '0000000000' && (
                 <div className="absolute bottom-16 left-2 bg-[#202c33] border border-[#2f3b43] rounded-lg p-2 grid grid-cols-6 gap-2 shadow-xl z-50">
                     <div className="col-span-6 flex justify-between items-center pb-2 border-b border-[#2f3b43] mb-2">
                         <span className="text-xs text-gray-400">Emojis</span>
                         <button onClick={() => setShowEmojiPicker(false)}><X size={14}/></button>
                     </div>
                     {COMMON_EMOJIS.map(em => (
                         <button key={em} onClick={() => addEmoji(em)} className="text-xl hover:bg-[#2a3942] rounded p-1 transition">{em}</button>
                     ))}
                 </div>
             )}

             {/* BOTONES DESHABILITADOS VISUALMENTE */}
             <button 
                disabled={user?.num_Tel === '0000000000'} 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                className={`p-2 text-[#8696a0] hover:text-[#00a884] ${user?.num_Tel === '0000000000' ? 'opacity-40 cursor-not-allowed' : ''}`}
             >
                <Smile/>
             </button>
             
             <button 
                disabled={user?.num_Tel === '0000000000'} 
                onClick={() => fileInputRef.current.click()} 
                className={`p-2 text-[#8696a0] hover:text-[#00a884] ${user?.num_Tel === '0000000000' ? 'opacity-40 cursor-not-allowed' : ''}`}
             >
                <Paperclip/>
             </button>
             
             <div className="flex-1 bg-[#2a3942] rounded-lg flex items-center px-4 py-2 min-h-[45px]">
                <input 
                    type="text" 
                    value={inputText} 
                    onChange={e => setInputText(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()} 
                    placeholder={user?.num_Tel === '0000000000' ? "Modo de demostración (Solo traducción)" : (isRecording ? "Grabando..." : "Mensaje")} 
                    disabled={isRecording || user?.num_Tel === '0000000000'} 
                    className={`bg-transparent w-full outline-none text-[#d1d7db] text-sm ${isRecording ? 'italic text-[#00a884]' : ''} ${user?.num_Tel === '0000000000' ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
             </div>
             
             {/* MICRÓFONO DESHABILITADO */}
             {!inputText && !isRecording && (
                <button 
                    disabled={user?.num_Tel === '0000000000'} 
                    onClick={startRecording} 
                    className={`p-3 text-[#8696a0] hover:text-white ${user?.num_Tel === '0000000000' ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                    <Mic size={20}/>
                </button>
             )}
             
             {isRecording && <button onClick={stopRecording} className="p-3 bg-red-500 rounded-full text-white animate-pulse"><Square size={20}/></button>}
             {!isRecording && inputText && <button onClick={() => handleSendMessage()} className="p-3 bg-[#00a884] rounded-full text-white"><Send size={20}/></button>}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-[#222e35] text-center border-b-8 border-[#00a884]"><h1 className="text-3xl text-[#e9edef] font-light mb-4">WhatsApp X</h1>
        <p className="text-[#8696a0]">Selecciona un chat</p></div>
      )}
      {/* MODAL DE ADVERTENCIA DEMO */}
      {showDemoWarning && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[99999] p-4">
              <div className="bg-[#202c33] p-8 rounded-lg max-w-sm w-full border border-[#00a884] shadow-2xl text-center relative animate-pulse-once">
                  <h3 className="text-[#00a884] font-bold text-xl mb-4 flex items-center justify-center gap-2">
                      ⚠️ Versión de Demostración
                  </h3>
                  <p className="text-[#e9edef] mb-6 text-sm leading-relaxed">
                      Por protección del portafolio y de la base de datos central en Oracle, <strong>la mayoría de las acciones de escritura están inhabilitadas</strong>.
                      <br/><br/>
                      Podrá navegar libremente y probar nuestra integración de traducción en tiempo real con la API de DeepL (Límite: 15 peticiones).
                  </p>
                  <button 
                      onClick={() => setShowDemoWarning(false)} 
                      className="w-full bg-[#00a884] text-[#111b21] font-bold py-3 rounded hover:bg-[#008f6f] transition-colors"
                  >
                      Entendido
                  </button>
              </div>
          </div>
      )}

      {confirmDialog.isOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[99999] p-4">
              <div className="bg-[#202c33] p-6 rounded-lg max-w-sm w-full border border-[#2f3b43] shadow-2xl relative">
                  <h3 className="text-[#e9edef] font-bold text-lg mb-2">{confirmDialog.title}</h3>
                  <p className="text-[#8696a0] mb-8 text-sm">
                      {confirmDialog.message}
                  </p>
                  <div className="flex justify-end gap-3">
                      <button 
                          onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                          className="px-4 py-2 text-[#00a884] hover:bg-[#2a3942] rounded font-medium transition-colors"
                      >
                          Cancelar
                      </button>
                      <button 
                          onClick={async () => {
                              if (confirmDialog.action) {
                                  await confirmDialog.action();
                              }
                              setConfirmDialog({ ...confirmDialog, isOpen: false });
                          }}
                          className="px-4 py-2 bg-[#ef4444] text-[#111b21] rounded font-bold hover:bg-[#dc2626] transition-colors"
                      >
                          Eliminar
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}