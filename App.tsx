/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Cpu, 
  Home as HomeIcon, 
  Shirt, 
  Baby, 
  Sparkles, 
  Compass, 
  Car, 
  Layers, 
  Plus, 
  Search, 
  Heart, 
  Star, 
  CheckCircle, 
  XCircle, 
  ExternalLink, 
  Trash2, 
  Edit, 
  Save, 
  Undo2, 
  X, 
  Loader2, 
  Filter, 
  TrendingUp, 
  FileText, 
  Check, 
  ThumbsUp, 
  MessageSquareCode,
  Upload,
  Image,
  Lock,
  LogIn,
  LogOut,
  Laptop,
  Luggage
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Deal, CATEGORIES, CategoryType } from "./types";
import { initialDeals } from "./initialDeals";

export default function App() {
  // --- States ---
  const [deals, setDeals] = useState<Deal[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("הכל");
  const [sortBy, setSortBy] = useState<"newest" | "likes" | "rating">("newest");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  // AI Extraction States
  const [inputUrl, setInputUrl] = useState("");
  const [inputImageUrl, setInputImageUrl] = useState("");
  const [screenshotImage, setScreenshotImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Modals & Editing States
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [isManualAdding, setIsManualAdding] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showAdminToggle, setShowAdminToggle] = useState(false);

  // Authentication states
  const [adminToken, setAdminToken] = useState<string | null>(localStorage.getItem("admin_token"));
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPasscode, setLoginPasscode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setAdminToken(null);
    setIsAdminMode(false);
  };

  const handlePasscodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (!loginPasscode) return;

    setIsLoggingIn(true);
    try {
      const response = await fetch("/api/auth/verify-passcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: loginPasscode })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("admin_token", data.token);
        setAdminToken(data.token);
        setIsAdminMode(true);
        setShowLoginModal(false);
        setLoginPasscode("");
      } else {
        const data = await response.json();
        setLoginError(data.error || "קוד גישה שגוי");
      }
    } catch (err) {
      console.error(err);
      setLoginError("אירעה שגיאה בחיבור לשרת");
    } finally {
      setIsLoggingIn(false);
    }
  };
  
  // Inline Notes State helper (id -> notes string)
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  // Form State for Manual Adding / AI Reviewing
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<string>(CATEGORIES[0]);
  const [formPriceRange, setFormPriceRange] = useState("");
  const [formRating, setFormRating] = useState(4.8);
  const [formDescription, setFormDescription] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formPros, setFormPros] = useState<string[]>(["", "", ""]);
  const [formCons, setFormCons] = useState<string[]>(["", ""]);
  const [formImageKeyword, setFormImageKeyword] = useState("gadget");
  const [formCustomImage, setFormCustomImage] = useState<string | null>(null);
  const [formNotes, setFormNotes] = useState("");

  // --- Load and Save from Full-Stack Express Server ---
  useEffect(() => {
    fetchDeals();
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "true" || params.get("edit") === "true") {
      setShowAdminToggle(true);
    }
  }, []);

  const fetchDeals = async () => {
    try {
      const response = await fetch("/api/deals");
      if (response.ok) {
        const data = await response.json();
        setDeals(data);
      } else {
        setDeals(initialDeals);
      }
    } catch (e) {
      console.error("Error fetching deals:", e);
      setDeals(initialDeals);
    }
  };

  // --- Map Category to Lucide Icon ---
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "אלקטרוניקה":
      case "אלקטרוניקה וגאדג'טים":
        return <Cpu className="w-4 h-4" />;
      case "גאדג'טים":
        return <Laptop className="w-4 h-4" />;
      case "טיולים ונסיעות":
        return <Luggage className="w-4 h-4" />;
      case "בית ומטבח":
        return <HomeIcon className="w-4 h-4" />;
      case "אופנה ואקססוריז":
        return <Shirt className="w-4 h-4" />;
      case "צעצועים וילדים":
        return <Baby className="w-4 h-4" />;
      case "בריאות, טיפוח ויופי":
        return <Sparkles className="w-4 h-4" />;
      case "ספורט, קמפינג ופנאי":
        return <Compass className="w-4 h-4" />;
      case "רכב ואופנועים":
        return <Car className="w-4 h-4" />;
      default:
        return <Layers className="w-4 h-4" />;
    }
  };

  // --- Screenshot & Drag and Drop Handlers ---
  const handleImageChange = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageChange(e.dataTransfer.files[0]);
    }
  };

  // --- Analyze URL with Gemini Server Endpoint ---
  const handleAnalyzeUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl) return;

    if (!inputUrl.toLowerCase().includes("aliexpress.com") && !inputUrl.toLowerCase().includes("ali.pub")) {
      setErrorMessage("נא להזין קישור תקין של אתר אליאקספרס (AliExpress)");
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage("");
    setAnalysisStep("שולח מידע וקישור לניתוח בינה מלאכותית...");

    const steps = [
      screenshotImage ? "מעבד את תצלום המסך של המוצר ומנתח טקסטים..." : "מפענח את מבנה הקישור ומזהה מזהי מוצר...",
      "מריץ מודל בינה מלאכותית רב-מודלי לקריאת פרטים...",
      "מחבר נתונים ומסווג לקטגוריה הנכונה...",
      "מנסח כותרת שיווקית קולחת ותיאור מפורט בעברית...",
      "מגבש רשימת יתרונות וחסרונות ובוחר מילות מפתח..."
    ];

    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < steps.length) {
        setAnalysisStep(steps[stepIndex]);
        stepIndex++;
      }
    }, 1200);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminToken ? { "Authorization": `Bearer ${adminToken}` } : {})
        },
        body: JSON.stringify({ url: inputUrl, image: screenshotImage, imageUrl: inputImageUrl })
      });

      clearInterval(interval);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "שגיאה בפנייה לשרת");
      }

      const data = await response.json();
      
      // Load AI data into the form state for review
      setFormTitle(data.title || "מוצר מאליאקספרס");
      setFormCategory(data.category || CATEGORIES[0]);
      setFormPriceRange(data.priceRange || "₪30 - ₪80");
      setFormRating(data.rating || 4.7);
      setFormDescription(data.description || "");
      setFormUrl(inputUrl);
      setFormPros(data.pros && data.pros.length ? data.pros : ["", "", ""]);
      setFormCons(data.cons && data.cons.length ? data.cons : ["", ""]);
      setFormImageKeyword(data.imageSearchKeyword || "gadget");
      setFormCustomImage(inputImageUrl || screenshotImage || null);
      setFormNotes(""); // Reset notes

      // Open editing dialog for review
      setEditingDeal({
        id: "new_ai",
        url: inputUrl,
        title: data.title || "מוצר מאליאקספרס",
        category: data.category || CATEGORIES[0],
        priceRange: data.priceRange || "₪30 - ₪80",
        rating: data.rating || 4.7,
        description: data.description || "",
        pros: data.pros || [],
        cons: data.cons || [],
        imageSearchKeyword: data.imageSearchKeyword || "gadget",
        customImage: inputImageUrl || screenshotImage || undefined,
        createdAt: new Date().toISOString()
      });

      setInputUrl("");
      setInputImageUrl("");
      setScreenshotImage(null);
    } catch (err: any) {
      clearInterval(interval);
      console.error(err);
      setErrorMessage(err.message || "אירעה שגיאה בחיבור לבינה המלאכותית. נא לנסות שוב.");
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep("");
    }
  };

  // --- Trigger Manual Add Mode ---
  const handleOpenManualAdd = () => {
    setIsManualAdding(true);
    setFormTitle("");
    setFormCategory(CATEGORIES[0]);
    setFormPriceRange("₪");
    setFormRating(4.8);
    setFormDescription("");
    setFormUrl("");
    setFormPros(["", "", ""]);
    setFormCons(["", ""]);
    setFormImageKeyword("gadget");
    setFormCustomImage(null);
    setFormNotes("");
    
    setEditingDeal({
      id: "new_manual",
      url: "",
      title: "",
      category: CATEGORIES[0],
      priceRange: "",
      rating: 4.8,
      description: "",
      pros: [],
      cons: [],
      imageSearchKeyword: "gadget",
      createdAt: new Date().toISOString()
    });
  };

  // --- Trigger Edit Existing Deal ---
  const handleEditDeal = (deal: Deal) => {
    setFormTitle(deal.title);
    setFormCategory(deal.category);
    setFormPriceRange(deal.priceRange);
    setFormRating(deal.rating);
    setFormDescription(deal.description);
    setFormUrl(deal.url);
    setFormPros([...deal.pros]);
    setFormCons([...deal.cons]);
    setFormImageKeyword(deal.imageSearchKeyword);
    setFormCustomImage(deal.customImage || null);
    setFormNotes(deal.personalNotes || "");
    setEditingDeal(deal);
  };

  // --- Save / Confirm New or Edited Deal ---
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formUrl) {
      alert("נא למלא שדות חובה: כותרת וקישור למוצר");
      return;
    }

    const filteredPros = formPros.filter(p => p.trim() !== "");
    const filteredCons = formCons.filter(c => c.trim() !== "");

    if (!editingDeal) return;

    if (editingDeal.id === "new_ai" || editingDeal.id === "new_manual") {
      // It's a new recommendation
      const newDeal: Deal = {
        id: Date.now().toString(),
        url: formUrl,
        title: formTitle,
        category: formCategory,
        priceRange: formPriceRange,
        rating: Number(formRating),
        description: formDescription,
        pros: filteredPros,
        cons: filteredCons,
        imageSearchKeyword: formImageKeyword || "shopping",
        customImage: formCustomImage || undefined,
        createdAt: new Date().toISOString(),
        isFavorite: false,
        likes: 0,
        personalNotes: formNotes || undefined
      };

      try {
        const response = await fetch("/api/deals", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            ...(adminToken ? { "Authorization": `Bearer ${adminToken}` } : {})
          },
          body: JSON.stringify(newDeal)
        });
        if (response.ok) {
          fetchDeals();
        }
      } catch (e) {
        console.error("Error saving new deal:", e);
      }

      setDeals([newDeal, ...deals]);
    } else {
      // It's an edit of an existing deal
      const updatedDeal = {
        ...editingDeal,
        url: formUrl,
        title: formTitle,
        category: formCategory,
        priceRange: formPriceRange,
        rating: Number(formRating),
        description: formDescription,
        pros: filteredPros,
        cons: filteredCons,
        imageSearchKeyword: formImageKeyword,
        customImage: formCustomImage || undefined,
        personalNotes: formNotes || undefined
      };

      try {
        const response = await fetch(`/api/deals/${editingDeal.id}`, {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            ...(adminToken ? { "Authorization": `Bearer ${adminToken}` } : {})
          },
          body: JSON.stringify(updatedDeal)
        });
        if (response.ok) {
          fetchDeals();
        }
      } catch (e) {
        console.error("Error updating deal:", e);
      }

      const updated = deals.map(d => d.id === editingDeal.id ? updatedDeal : d);
      setDeals(updated);
    }

    setEditingDeal(null);
    setIsManualAdding(false);
  };

  // --- Delete Recommendation ---
  const handleDeleteDeal = async (id: string) => {
    if (window.confirm("האם אתה בטוח שברצונך למחוק המלצה זו?")) {
      try {
        const response = await fetch(`/api/deals/${id}`, {
          method: "DELETE",
          headers: {
            ...(adminToken ? { "Authorization": `Bearer ${adminToken}` } : {})
          }
        });
        if (response.ok) {
          fetchDeals();
        }
      } catch (e) {
        console.error("Error deleting deal:", e);
      }

      const filtered = deals.filter(d => d.id !== id);
      setDeals(filtered);
    }
  };

  // --- Toggle Favorite Status ---
  const toggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = deals.find(d => d.id === id);
    if (!target) return;

    const updatedDeal = { ...target, isFavorite: !target.isFavorite };

    try {
      const response = await fetch(`/api/deals/${id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          ...(adminToken ? { "Authorization": `Bearer ${adminToken}` } : {})
        },
        body: JSON.stringify(updatedDeal)
      });
      if (response.ok) {
        fetchDeals();
      }
    } catch (e) {
      console.error("Error toggling favorite:", e);
    }

    const updated = deals.map(d => d.id === id ? updatedDeal : d);
    setDeals(updated);
  };

  // --- Like a Deal ---
  const handleLikeDeal = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = deals.find(d => d.id === id);
    if (!target) return;

    try {
      const response = await fetch(`/api/deals/${id}/like`, {
        method: "POST"
      });
      if (response.ok) {
        fetchDeals();
      }
    } catch (e) {
      console.error("Error liking deal:", e);
    }

    const updatedDeal = { ...target, likes: (target.likes || 0) + 1 };
    const updated = deals.map(d => d.id === id ? updatedDeal : d);
    setDeals(updated);
  };

  // --- Save Inline Notes ---
  const handleSaveInlineNotes = async (id: string) => {
    const draftText = notesDraft[id];
    if (draftText === undefined) return;

    const target = deals.find(d => d.id === id);
    if (!target) return;

    const updatedDeal = { ...target, personalNotes: draftText.trim() || undefined };

    try {
      const response = await fetch(`/api/deals/${id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          ...(adminToken ? { "Authorization": `Bearer ${adminToken}` } : {})
        },
        body: JSON.stringify(updatedDeal)
      });
      if (response.ok) {
        fetchDeals();
      }
    } catch (e) {
      console.error("Error saving notes:", e);
    }

    const updated = deals.map(d => d.id === id ? updatedDeal : d);
    setDeals(updated);

    // Clean up draft helper
    const newDrafts = { ...notesDraft };
    delete newDrafts[id];
    setNotesDraft(newDrafts);
  };

  // --- Filtering & Sorting Logic ---
  const filteredDeals = deals.filter(deal => {
    const matchesSearch = 
      deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (deal.personalNotes && deal.personalNotes.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === "הכל" || deal.category === selectedCategory;
    const matchesFavorite = !showFavoritesOnly || deal.isFavorite;

    return matchesSearch && matchesCategory && matchesFavorite;
  });

  const sortedDeals = [...filteredDeals].sort((a, b) => {
    if (sortBy === "likes") {
      return (b.likes || 0) - (a.likes || 0);
    }
    if (sortBy === "rating") {
      return b.rating - a.rating;
    }
    // newest
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // --- Highlights Stats ---
  const totalCount = deals.length;
  const favoriteCount = deals.filter(d => d.isFavorite).length;
  const electroCount = deals.filter(d => d.category === "אלקטרוניקה" || d.category === "גאדג'טים" || d.category === "אלקטרוניקה וגאדג'טים").length;
  const travelCount = deals.filter(d => d.category === "טיולים ונסיעות").length;

  return (
    <div className="min-h-screen font-sans bg-slate-50 text-slate-800 pb-16 selection:bg-rose-100 selection:text-rose-900" dir="rtl">
      {/* --- Top Decorative Bar --- */}
      <div className="h-2 bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 w-full" />

      {/* --- Header & Hero Section --- */}
      <header className="bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-5 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div 
            className="flex items-center gap-3 select-none cursor-default"
            onDoubleClick={() => {
              setShowLoginModal(true);
            }}
          >
            <div className="p-3 bg-red-500 text-white rounded-2xl shadow-md shadow-red-200">
              <TrendingUp className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                AliBest <span className="text-red-500">Deals</span>
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                אתר ההמלצות והדילים הטובים ביותר מאליאקספרס
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View/Admin Toggle - only visible if adminToken exists or showAdminToggle was enabled via URL query params */}
            {(adminToken || showAdminToggle) && (
              <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAdminMode(false)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition duration-200 flex items-center gap-1.5 cursor-pointer ${
                    !isAdminMode 
                      ? "bg-white text-slate-800 shadow-xs" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span>👀 תצוגת אתר</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (adminToken) {
                      setIsAdminMode(true);
                    } else {
                      setShowLoginModal(true);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition duration-200 flex items-center gap-1.5 cursor-pointer ${
                    isAdminMode 
                      ? "bg-red-500 text-white shadow-xs" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span>⚙️ מצב עריכה</span>
                  {isAdminMode && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>

                {adminToken && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-2 py-1.5 text-xs text-slate-400 hover:text-red-500 transition duration-200 cursor-pointer flex items-center gap-1"
                    title="התנתק ממצב מנהל"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">התנתק</span>
                  </button>
                )}
              </div>
            )}

            {isAdminMode && (
              <button
                onClick={handleOpenManualAdd}
                id="btn-manual-add"
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-slate-300 hover:border-slate-450 font-semibold transition text-slate-700 bg-white hover:bg-slate-50 cursor-pointer text-xs"
              >
                <Plus className="w-4 h-4 text-slate-500" />
                הוספה ידנית
              </button>
            )}
          </div>
        </div>
      </header>

      {/* --- Main Dashboard Container --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        {/* --- Highlight Statistics Grid --- */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8" id="stats-section">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition duration-300 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs font-medium">סה"כ המלצות</p>
              <h4 className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
              📊
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition duration-300 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs font-medium">המועדפים שלי</p>
              <h4 className="text-2xl font-bold text-slate-900 mt-1">{favoriteCount}</h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
              <Heart className="w-5 h-5 fill-rose-500" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition duration-300 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs font-medium">גאדג'טים ואלקטרוניקה</p>
              <h4 className="text-2xl font-bold text-slate-900 mt-1">{electroCount}</h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition duration-300 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs font-medium">טיולים ונסיעות</p>
              <h4 className="text-2xl font-bold text-slate-900 mt-1">{travelCount}</h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Luggage className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* --- AI URL Input Section --- */}
        {isAdminMode && (
          <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-red-950 text-white rounded-3xl p-6 sm:p-8 mb-8 shadow-xl relative overflow-hidden animate-in fade-in duration-300" id="ai-input-section">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-3xl relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30 mb-4">
              ✨ קסם ה-AI של AliBest
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              הדבק קישור אליאקספרס וניתן לבינה המלאכותית לעשות את השאר!
            </h2>
            <p className="text-slate-300 text-sm sm:text-base mt-2 max-w-2xl">
              פשוט הדבק את הקישור של המוצר ב-AliExpress. באפשרותך גם לגרור או להעלות תצלום מסך של המוצר (כולל מחיר או מפרט) כדי לחלץ את הנתונים בדיוק מירבי, במיוחד אם הקישור חסום או קשה לסריקה!
            </p>

            <form onSubmit={handleAnalyzeUrl} className="mt-6 space-y-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type="url"
                    placeholder="הדבק קישור של AliExpress כאן... (למשל: https://www.aliexpress.com/item/...)"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    disabled={isAnalyzing}
                    id="aliexpress-url-input"
                    className="w-full bg-slate-950/60 border border-slate-700 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 rounded-2xl py-3.5 px-4 pr-11 text-white placeholder-slate-500 text-sm transition outline-hidden"
                    required
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                    <ExternalLink className="w-5 h-5" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isAnalyzing || !inputUrl}
                  id="btn-analyze-ai"
                  className="bg-red-500 hover:bg-red-600 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold py-3.5 px-6 rounded-2xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-500/20 active:scale-[0.98] whitespace-nowrap shrink-0"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      מנתח את הקישור...
                    </>
                  ) : (
                    <>
                      <span>✨ נתח והוסף דיל</span>
                    </>
                  )}
                </button>
              </div>

              {/* Direct Product Image URL Option */}
              <div className="space-y-1.5">
                <div className="relative">
                  <input
                    type="url"
                    placeholder="קישור ישיר לתמונת המוצר (אופציונלי - למשל: https://example.com/image.jpg)"
                    value={inputImageUrl}
                    onChange={(e) => {
                      let val = e.target.value.trim();
                      if (val.startsWith("//")) {
                        val = "https:" + val;
                      }
                      setInputImageUrl(val);
                    }}
                    disabled={isAnalyzing}
                    className="w-full bg-slate-950/60 border border-slate-700 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 rounded-2xl py-3 px-4 pr-11 text-white placeholder-slate-500 text-xs transition outline-hidden"
                    dir="ltr"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                    <Image className="w-4 h-4" />
                  </div>
                </div>
                {inputImageUrl && (inputImageUrl.includes("aliexpress.com") || inputImageUrl.includes("alicdn.com")) && (inputImageUrl.includes("item/") || inputImageUrl.includes("detail") || inputImageUrl.includes("_") || inputImageUrl.includes("share") || !inputImageUrl.includes("/kf/")) && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-3 rounded-xl text-[11px] leading-relaxed" dir="rtl">
                    <p className="font-bold flex items-center gap-1 mb-1 text-amber-400">
                      ⚠️ שים לב: הדבקת קישור של דף מוצר/שיתוף, ולא קישור לתמונה!
                    </p>
                    <p className="text-slate-200">
                      קישור שיתוף של אליאקפרס מפנה לדף אינטרנט שלם. דפדפנים לא יכולים להציג אותו כתמונה.
                    </p>
                    <p className="mt-1 font-bold text-amber-300">
                      💡 כיצד להשיג את קישור התמונה האמיתי?
                    </p>
                    <ol className="list-decimal list-inside mt-0.5 space-y-0.5 text-slate-300">
                      <li>פתח את דף המוצר באליאקספרס במחשב או בדפדפן.</li>
                      <li>לחץ <b>קליק ימני (Right Click)</b> על תמונת המוצר הגדולה.</li>
                      <li>בחר באפשרות <b>"העתק כתובת תמונה" (Copy image address)</b>.</li>
                      <li>הדבק את הכתובת שהועתקה כאן בתיבה (היא בדרך כלל מכילה <code>alicdn.com/kf/</code>).</li>
                    </ol>
                  </div>
                )}
              </div>

              {/* Multimodal Screenshot Upload Area */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-4 transition flex flex-col items-center justify-center text-center cursor-pointer relative min-h-[110px] ${
                    isDragging 
                      ? "border-red-500 bg-red-500/10 text-white animate-pulse" 
                      : screenshotImage 
                        ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-300"
                        : "border-slate-700 hover:border-slate-500 bg-slate-950/40 text-slate-400"
                  }`}
                  onClick={() => document.getElementById("screenshot-file-input")?.click()}
                >
                  <input
                    type="file"
                    id="screenshot-file-input"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleImageChange(e.target.files[0]);
                      }
                    }}
                    disabled={isAnalyzing}
                  />
                  
                  {screenshotImage ? (
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                        <Check className="w-6 h-6" />
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-white">תצלום מסך נטען בהצלחה!</p>
                        <p className="text-[11px] text-emerald-400">ה-AI ישתמש בתצלום זה לחילוץ הנתונים מהקישור</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="p-2.5 bg-slate-800/60 rounded-xl mb-1 text-slate-300">
                        <FileText className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-semibold text-slate-200">
                        גרור ושחרר תצלום מסך של המוצר (אופציונלי)
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        מומלץ מאוד להעלות צילום מסך של דף המוצר כדי לקרוא מחיר ומפרט מדויקים במיוחד!
                      </p>
                    </>
                  )}
                </div>

                {screenshotImage && (
                  <div className="border border-slate-800 bg-slate-950/40 rounded-2xl p-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src={screenshotImage} 
                        alt="תצוגה מקדימה" 
                        className="w-16 h-16 object-cover rounded-xl border border-slate-700"
                        referrerPolicy="no-referrer"
                      />
                      <div className="text-right">
                        <p className="text-xs font-semibold text-slate-200">תצוגה מקדימה של תצלום המסך</p>
                        <p className="text-[10px] text-slate-400">ה-AI יקרא שמות, דגמים ומחירים בעברית או באנגלית</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setScreenshotImage(null);
                      }}
                      className="p-2 text-slate-400 hover:text-red-400 bg-slate-800/40 hover:bg-red-500/10 rounded-xl transition cursor-pointer"
                      title="מחק צילום מסך"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </form>

            {/* Error Message */}
            {errorMessage && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl text-sm flex items-center gap-2"
              >
                <XCircle className="w-5 h-5 shrink-0" />
                <span>{errorMessage}</span>
              </motion.div>
            )}

            {/* AI Loading State with Stepper */}
            {isAnalyzing && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="mt-6 bg-slate-950/40 border border-slate-800 rounded-2xl p-4 text-center"
              >
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Loader2 className="w-6 h-6 animate-spin text-red-500" />
                  <p className="font-semibold text-slate-200 text-sm">ניתוח בינה מלאכותית פעיל</p>
                </div>
                <p className="text-slate-400 text-xs animate-pulse">{analysisStep}</p>
              </motion.div>
            )}
          </div>
        </section>
        )}

        {/* --- Filters, Search, and Sorting Section --- */}
        <section className="bg-white border border-slate-200 rounded-3xl p-5 mb-8 shadow-xs" id="filters-section">
          <div className="flex flex-col lg:flex-row gap-5 items-stretch lg:items-center justify-between">
            
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="חפש המלצות, מוצרים או הערות..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                id="search-input"
                className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 rounded-2xl py-2.5 px-4 pr-10 text-slate-800 placeholder-slate-400 text-sm transition outline-hidden"
              />
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")} 
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sorting, Favorites Filter, Reset */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Sort By Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs font-medium shrink-0">מיין לפי:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  id="sort-select"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 outline-hidden focus:border-red-500 transition"
                >
                  <option value="newest">הכי חדש</option>
                  <option value="likes">הכי פופולרי 👍</option>
                  <option value="rating">דירוג גבוה ⭐</option>
                </select>
              </div>

              {/* Favorites Only Switch */}
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                id="btn-favorites-toggle"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                  showFavoritesOnly 
                    ? "bg-rose-50 text-rose-600 border border-rose-200" 
                    : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? "fill-rose-500 text-rose-500" : ""}`} />
                רק מועדפים ({favoriteCount})
              </button>

              {/* Reset Filters button */}
              {(selectedCategory !== "הכל" || searchQuery !== "" || showFavoritesOnly) && (
                <button
                  onClick={() => {
                    setSelectedCategory("הכל");
                    setSearchQuery("");
                    setShowFavoritesOnly(false);
                  }}
                  className="text-xs text-red-500 hover:text-red-600 font-medium hover:underline flex items-center gap-1"
                >
                  <Undo2 className="w-3 h-3" />
                  אפס סינונים
                </button>
              )}
            </div>
          </div>

          {/* Categories Tab Bar */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-slate-400 text-xs font-medium mb-3">סינון לפי קטגוריות:</p>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => setSelectedCategory("הכל")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  selectedCategory === "הכל"
                    ? "bg-red-500 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                הכל
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    selectedCategory === cat
                      ? "bg-red-500 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {getCategoryIcon(cat)}
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* --- Curated Recommendations Grid --- */}
        <section id="recommendations-grid">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <span>המלצות שמורות</span>
              <span className="text-sm font-medium text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-full">
                {sortedDeals.length} מוצרים
              </span>
            </h3>

            {selectedCategory !== "הכל" && (
              <span className="text-xs font-semibold bg-red-50 text-red-600 border border-red-100 px-3 py-1 rounded-lg">
                קטגוריה: {selectedCategory}
              </span>
            )}
          </div>

          {sortedDeals.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center max-w-xl mx-auto my-8">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                🔎
              </div>
              <h4 className="text-lg font-bold text-slate-900">לא נמצאו המלצות מתאימות</h4>
              <p className="text-slate-500 text-sm mt-2">
                לא מצאנו המלצות העונות על הסינונים שבחרת. נסה לשנות את מילות החיפוש או לבחור קטגוריה אחרת.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory("הכל");
                  setSearchQuery("");
                  setShowFavoritesOnly(false);
                }}
                className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                הצג את כל המוצרים
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {sortedDeals.map((deal) => {
                  // Generate an elegant Unsplash source URL based on keyword to load gorgeous, context-relevant imagery
                  const imageUrl = `https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=600&q=80`; // fallback
                  const keyword = deal.imageSearchKeyword.toLowerCase();
                  
                  // Simple high-quality Unsplash image selector based on keyword
                  let dynamicImageUrl = deal.customImage || `https://images.unsplash.com/featured/600x400/?${encodeURIComponent(keyword)}`;
                  if (!deal.customImage) {
                    if (keyword.includes("headphones")) {
                      dynamicImageUrl = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80";
                    } else if (keyword.includes("coffee")) {
                      dynamicImageUrl = "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80";
                    } else if (keyword.includes("car")) {
                      dynamicImageUrl = "https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&w=600&q=80";
                    } else if (keyword.includes("speaker")) {
                      dynamicImageUrl = "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=600&q=80";
                    } else if (keyword.includes("smartwatch") || keyword.includes("watch")) {
                      dynamicImageUrl = "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=600&q=80";
                    } else if (keyword.includes("bag") || keyword.includes("backpack")) {
                      dynamicImageUrl = "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80";
                    } else if (keyword.includes("kitchen")) {
                      dynamicImageUrl = "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=600&q=80";
                    }
                  }

                  return (
                    <motion.article
                      key={deal.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 hover:border-red-300 shadow-xs hover:shadow-lg transition duration-300 flex flex-col h-full group"
                    >
                      {/* Card Image Area */}
                      <div className="relative h-48 bg-slate-100 overflow-hidden shrink-0">
                        <img
                          src={dynamicImageUrl}
                          alt={deal.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                        
                        {/* Gradient overlay for readability */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                        {/* Top float actions */}
                        <div className="absolute top-3 left-3 flex gap-1.5">
                          <button
                            onClick={(e) => toggleFavorite(deal.id, e)}
                            className="w-8.5 h-8.5 rounded-full bg-white/95 backdrop-blur-xs flex items-center justify-center shadow-md text-slate-500 hover:text-rose-500 active:scale-90 transition cursor-pointer"
                            title={deal.isFavorite ? "הסר מהמועדפים" : "הוסף למועדפים"}
                          >
                            <Heart className={`w-4.5 h-4.5 ${deal.isFavorite ? "fill-rose-500 text-rose-500" : ""}`} />
                          </button>
                        </div>

                        {/* Category Badge */}
                        <div className="absolute top-3 right-3 bg-red-500/90 text-white backdrop-blur-xs px-3 py-1 rounded-full text-[11px] font-bold shadow-sm flex items-center gap-1">
                          {getCategoryIcon(deal.category)}
                          <span>{deal.category}</span>
                        </div>

                        {/* Price Badge on bottom right */}
                        <div className="absolute bottom-3 right-3 bg-slate-900/90 text-emerald-400 backdrop-blur-xs px-3 py-1.5 rounded-xl text-sm font-black shadow-md border border-slate-800">
                          {deal.priceRange}
                        </div>

                        {/* Rating on bottom left */}
                        <div className="absolute bottom-3 left-3 bg-slate-900/90 text-amber-400 backdrop-blur-xs px-2.5 py-1 rounded-xl text-xs font-bold shadow-md flex items-center gap-1 border border-slate-800">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{deal.rating.toFixed(1)}</span>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div>
                          {/* Title */}
                          <h4 className="text-base font-bold text-slate-900 line-clamp-2 leading-snug tracking-tight mb-2 min-h-[3rem] group-hover:text-red-500 transition">
                            {deal.title}
                          </h4>

                          {/* Description */}
                          <p className="text-slate-500 text-xs leading-relaxed line-clamp-4">
                            {deal.description}
                          </p>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
                        {/* Likes counter and Admin buttons */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => handleLikeDeal(deal.id, e)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer active:scale-95 transition"
                          >
                            <ThumbsUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-500 transition" />
                            <span>{deal.likes || 0}</span>
                          </button>

                          {isAdminMode && (
                            <>
                              <button
                                onClick={() => handleEditDeal(deal)}
                                className="p-1.5 text-slate-400 hover:text-blue-500 rounded-lg hover:bg-slate-200/50 transition cursor-pointer"
                                title="עריכה"
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteDeal(deal.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-200/50 transition cursor-pointer"
                                title="מחיקה"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>

                        {/* AliExpress External Link Button */}
                        <a
                          href={deal.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-red-500 hover:bg-red-600 text-white font-bold text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 shadow-sm shadow-red-500/10 transition active:scale-[0.98]"
                        >
                          <span>למוצר באלי</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </section>
      </main>

      {/* --- Review & Save Modal (Also handles Editing / Manual Add) --- */}
      <AnimatePresence>
        {editingDeal && (
          <div className="fixed inset-0 z-50 overflow-y-auto" id="edit-modal">
            {/* Overlay */}
            <div 
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
              onClick={() => { setEditingDeal(null); setIsManualAdding(false); }}
            />

            {/* Modal Body Wrapper */}
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative transform overflow-hidden rounded-3xl bg-white text-right shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-2xl"
              >
                {/* Header */}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-100 text-red-500 flex items-center justify-center font-bold text-sm">
                      ✨
                    </div>
                    <h3 className="text-lg font-extrabold text-slate-900">
                      {editingDeal.id === "new_ai" 
                        ? "סקירת המלצת בינה מלאכותית" 
                        : editingDeal.id === "new_manual" 
                        ? "הוספת המלצה חדשה ידנית" 
                        : "עריכת המלצה קיימת"}
                    </h3>
                  </div>
                  <button
                    onClick={() => { setEditingDeal(null); setIsManualAdding(false); }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form Content */}
                <form onSubmit={handleSaveForm} className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
                  
                  {/* Title Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">
                      כותרת המוצר (עברית שיווקית ויפה) *
                    </label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 rounded-xl py-2 px-3 text-slate-800 text-sm transition outline-hidden"
                      placeholder="שם המוצר בעברית, למשל: אוזניות קשת אלחוטיות Baseus דגם H1..."
                      required
                    />
                  </div>

                  {/* AliExpress URL */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">
                      קישור AliExpress מקורי *
                    </label>
                    <input
                      type="url"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 rounded-xl py-2 px-3 text-slate-800 text-sm transition outline-hidden"
                      placeholder="https://www.aliexpress.com/item/..."
                      required
                    />
                  </div>

                  {/* Category & Price Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Category Select */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">
                        קטגוריית מוצר
                      </label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 focus:bg-white rounded-xl py-2 px-3 text-slate-800 text-sm transition outline-hidden"
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Price */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">
                        מחיר המוצר (למשל: ₪39)
                      </label>
                      <input
                        type="text"
                        value={formPriceRange}
                        onChange={(e) => setFormPriceRange(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 rounded-xl py-2 px-3 text-slate-800 text-sm transition outline-hidden"
                        placeholder="למשל: ₪39"
                      />
                    </div>
                  </div>

                  {/* Rating & Visual Keyword Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Rating Input */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">
                        דירוג גולשים (כוכבים מתוך 5.0)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="5"
                        value={formRating}
                        onChange={(e) => setFormRating(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 rounded-xl py-2 px-3 text-slate-800 text-sm transition outline-hidden"
                      />
                    </div>

                    {/* Image Search Keyword */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">
                        מילת מפתח באנגלית לתמונה (Unsplash Keyword)
                      </label>
                      <input
                        type="text"
                        value={formImageKeyword}
                        onChange={(e) => setFormImageKeyword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 rounded-xl py-2 px-3 text-slate-800 text-sm transition outline-hidden"
                        placeholder="למשל: headphones, coffee, clock, sunglasses"
                      />
                    </div>
                  </div>

                  {/* Custom Product Image Upload Area */}
                  <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                    <label className="block text-xs font-bold text-slate-700">
                      תמונת מוצר (העלאת תמונה אישית או Unsplash)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                      <div>
                        <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                          באפשרותך להעלות תמונה מותאמת אישית של המוצר שתוצג באתר (על ידי בחירת קובץ או הדבקת קישור ישיר), או להשתמש במילת המפתח שלמעלה מ-Unsplash.
                        </p>
                        <div className="flex flex-wrap gap-2 items-center">
                          <button
                            type="button"
                            onClick={() => document.getElementById("modal-custom-image-input")?.click()}
                            className="px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-450 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5 text-slate-500" />
                            <span>העלאת קובץ תמונה...</span>
                          </button>
                          <input
                            type="file"
                            id="modal-custom-image-input"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                const file = e.target.files[0];
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setFormCustomImage(reader.result as string);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </div>

                        <div className="mt-3 space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">
                            או הדבק קישור ישיר לתמונת המוצר:
                          </label>
                          <input
                            type="url"
                            placeholder="https://example.com/image.jpg"
                            value={formCustomImage && !formCustomImage.startsWith("data:") ? formCustomImage : ""}
                            onChange={(e) => {
                              let val = e.target.value.trim();
                              if (val.startsWith("//")) {
                                val = "https:" + val;
                              }
                              setFormCustomImage(val || null);
                            }}
                            className="w-full bg-white border border-slate-200 focus:border-red-500 rounded-xl py-1.5 px-3 text-slate-800 text-xs transition outline-hidden"
                            dir="ltr"
                          />
                          {formCustomImage && !formCustomImage.startsWith("data:") && (formCustomImage.includes("aliexpress.com") || formCustomImage.includes("alicdn.com")) && (formCustomImage.includes("item/") || formCustomImage.includes("detail") || formCustomImage.includes("_") || formCustomImage.includes("share") || !formCustomImage.includes("/kf/")) && (
                            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-lg text-[10px] leading-relaxed" dir="rtl">
                              <p className="font-bold mb-0.5">
                                ⚠️ שים לב: זהו קישור של דף מוצר/שיתוף, ולא קישור ישיר לתמונה!
                              </p>
                              <p className="text-slate-650">
                                קישור שיתוף של אליאקפרס מפנה לדף אינטרנט שלם. להעתקת כתובת התמונה האמיתית באליאקפרס: לחץ <b>קליק ימני (Right Click)</b> על תמונת המוצר הגדולה ובחר <b>"העתק כתובת תמונה" (Copy image address)</b>.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-center border border-slate-200 rounded-xl bg-white p-2 h-28 relative">
                        {formCustomImage ? (
                          <>
                            <img
                              src={formCustomImage}
                              alt="תמונת מוצר מותאמת אישית"
                              className="max-h-full max-w-full object-contain rounded-lg"
                              referrerPolicy="no-referrer"
                            />
                            <button
                              type="button"
                              onClick={() => setFormCustomImage(null)}
                              className="absolute top-1 right-1 p-1 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition"
                              title="הסר תמונה"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <div className="text-center text-slate-400 text-xs">
                            <Image className="w-6 h-6 mx-auto mb-1 opacity-60" />
                            <span className="block font-medium">אין תמונה אישית טעונה</span>
                            <span className="text-[10px]">יוצג: "{formImageKeyword || "gadget"}" מ-Unsplash</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recommendation Description */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">
                      תיאור המוצר וסיבות להמלצה
                    </label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 rounded-xl py-2 px-3 text-slate-800 text-sm transition outline-hidden resize-none"
                      placeholder="הסבר קצר על המוצר ולמה כדאי לקנות אותו..."
                    />
                  </div>

                  {/* Submit and Cancel Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => { setEditingDeal(null); setIsManualAdding(false); }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition cursor-pointer"
                    >
                      ביטול
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white font-bold text-sm rounded-xl transition shadow-md shadow-red-500/10 active:scale-[0.98] cursor-pointer"
                    >
                      {editingDeal.id === "new_ai" || editingDeal.id === "new_manual" 
                        ? "שמור והוסף לאתר" 
                        : "שמור שינויים"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Admin Passcode Login Modal --- */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto" id="login-modal">
            {/* Overlay */}
            <div 
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
              onClick={() => setShowLoginModal(false)}
            />

            {/* Modal Body */}
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative transform overflow-hidden rounded-3xl bg-white text-right shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-md p-6"
              >
                {/* Header with Close */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-100 text-red-500 flex items-center justify-center">
                      <Lock className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-extrabold text-slate-900">כניסה למצב עריכה</h3>
                  </div>
                  <button
                    onClick={() => setShowLoginModal(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                  המלצות האתר ופעולות העריכה מוגנות. רק מנהל האתר יכול להוסיף, לשנות או למחוק מוצרים. אנא הזן את קוד הגישה שלך כדי להמשיך.
                </p>

                {/* Form */}
                <form onSubmit={handlePasscodeLogin} className="mt-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      קוד גישה (Passcode)
                    </label>
                    <input
                      type="password"
                      value={loginPasscode}
                      onChange={(e) => setLoginPasscode(e.target.value)}
                      placeholder="הזן קוד גישה..."
                      className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 rounded-xl py-2.5 px-3 text-slate-800 text-sm transition outline-hidden"
                      required
                      autoFocus
                    />
                  </div>

                  {loginError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-semibold">
                      ⚠️ {loginError}
                    </div>
                  )}

                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl text-[10px] text-slate-500 leading-relaxed">
                    💡 <b>קוד גישה ברירת מחדל מאובטח:</b> קוד הגישה שונה לסיסמה אקראית וחכמה: <code>AliBest#SmartSecure8391</code>. ניתן להגדיר קוד אישי דרך <code>ADMIN_PASSCODE</code> בלוח הניהול.
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowLoginModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      ביטול
                    </button>
                    <button
                      type="submit"
                      disabled={isLoggingIn}
                      className="px-5 py-2 bg-red-500 hover:bg-red-600 disabled:bg-slate-400 text-white font-bold text-xs rounded-xl transition shadow-md shadow-red-500/10 active:scale-[0.98] flex items-center gap-1 cursor-pointer"
                    >
                      {isLoggingIn ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          מאמת...
                        </>
                      ) : (
                        <>
                          <LogIn className="w-3.5 h-3.5" />
                          <span>התחבר</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Footer --- */}
      <footer className="mt-20 border-t border-slate-200 bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-3">
          <p className="text-sm font-bold text-slate-800">
            AliBest <span className="text-red-500">Deals</span> © 2026
          </p>
          <p className="text-xs text-slate-400">
            הדילים הטובים ביותר מאליאקספרס במקום אחד. המערכת נעזרת במודל AI של Gemini לצורך תרגום, ניסוח וסיווג אוטומטי של המלצות ודילים.
          </p>
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 font-medium">
            <button 
              onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-1 hover:text-slate-600 transition bg-transparent border-none cursor-pointer focus:outline-hidden"
              title="כניסת מנהל מאובטחת"
            >
              <Lock className="w-3 h-3 text-emerald-500" />
              <span>חיבור מאובטח ומפוקח SSL</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
