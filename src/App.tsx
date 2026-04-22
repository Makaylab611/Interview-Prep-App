import { useState, useEffect, useRef } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  User
} from './firebase';
import { generateInterviewPrep, InterviewPrepResults, QuestionSet, WeakSpot } from './lib/gemini';
import { parseFile } from './lib/fileParser';
import { 
  FileText, 
  Briefcase, 
  Sparkles, 
  RefreshCw, 
  User as UserIcon, 
  LogOut, 
  History as HistoryIcon,
  Check,
  Copy,
  ChevronRight,
  ShieldAlert,
  Zap,
  Target,
  MessageSquare,
  BookOpen,
  ArrowRight,
  Upload,
  Info,
  FileUp,
  X,
  Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [resumeText, setResumeText] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [results, setResults] = useState<InterviewPrepResults | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'behavioral' | 'technical' | 'weakspots'>('behavioral');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);
      if (user) {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          updatedAt: serverTimestamp()
        }, { merge: true });

        const q = query(
          collection(db, 'preps'),
          where('uid', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const unsubHistory = onSnapshot(q, (snapshot) => {
          setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubHistory();
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Sign in error:', err);
      setError('Failed to sign in. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setResults(null);
      setHistory([]);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | undefined;
    if ('files' in e.target && e.target.files) {
      file = e.target.files[0];
    } else if ('dataTransfer' in e) {
      e.preventDefault();
      file = e.dataTransfer.files[0];
    }

    if (!file) return;
    
    setParsing(true);
    setError(null);
    setFileName(file.name);
    setIsDragging(false);

    try {
      const text = await parseFile(file);
      setResumeText(text);
      setIsEditing(false);
    } catch (err) {
      console.error('File parsing error:', err);
      setError('We couldn’t fully read your resume. Please upload a clearer file or paste text manually.');
      setFileName(null);
    } finally {
      setParsing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleGenerate = async () => {
    if (!resumeText.trim()) {
      setError('Please provide your resume content first.');
      return;
    }
    
    setGenerating(true);
    setError(null);
    setResults(null); // Clear previous results while generating

    try {
      const res = await generateInterviewPrep(resumeText, targetRole);
      
      if (!res || !res.behavioral || !res.technical) {
        throw new Error('Invalid response format from AI');
      }

      setResults(res);
      
      if (user) {
        try {
          await addDoc(collection(db, 'preps'), {
            uid: user.uid,
            resumeText,
            targetRole: targetRole || res.targetRole,
            analysis: res,
            createdAt: serverTimestamp()
          });
        } catch (dbErr) {
          console.error('Firestore save error:', dbErr);
          // Don't break the UI if history save fails
        }
      }

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('Generation error:', err);
      setError('We ran into an issue processing your resume. Please try again or paste your resume text manually.');
      setResults(null);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCw className="w-8 h-8 text-neutral-400" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-neutral-200">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Answer For Me: <span className="text-neutral-500">Interview Mode</span></h1>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors"
                  title="History"
                >
                  <HistoryIcon className="w-5 h-5" />
                </button>
                <div className="h-8 w-[1px] bg-neutral-200" />
                <div className="flex items-center gap-2">
                  <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-neutral-200" />
                  <button 
                    onClick={handleSignOut}
                    className="p-2 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={handleSignIn}
                className="px-4 py-2 bg-neutral-900 text-white rounded-full text-sm font-medium hover:bg-neutral-800 transition-colors flex items-center gap-2"
              >
                <UserIcon className="w-4 h-4" />
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-16">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-100 text-neutral-600 text-xs font-bold uppercase tracking-widest mb-6"
          >
            <Sparkles className="w-3 h-3" />
            AI-Powered Interview Prep
          </motion.div>
          <h2 className="text-5xl font-bold tracking-tight mb-6">
            Your resume is your <span className="text-neutral-500 italic">script.</span>
          </h2>
          <p className="text-neutral-500 text-lg max-w-2xl mx-auto">
            Analyze your actual experience to generate the most likely questions and strong, grounded answers. No fake experience, no generic fluff.
          </p>
        </div>

        {/* Input Section */}
        <section className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden mb-16">
          <div className="p-8 space-y-8">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Resume Content
                </label>
                {resumeText && (
                  <button 
                    onClick={() => setIsEditing(!isEditing)}
                    className="text-xs font-bold text-neutral-900 flex items-center gap-1 hover:underline"
                  >
                    <Edit3 className="w-3 h-3" />
                    {isEditing ? 'Save Changes' : 'Edit Resume Text'}
                  </button>
                )}
              </div>

              {!resumeText && !parsing ? (
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleFileUpload}
                  className={cn(
                    "relative border-2 border-dashed rounded-2xl p-12 text-center transition-all",
                    isDragging ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-400"
                  )}
                >
                  <input 
                    type="file" 
                    accept=".pdf,.docx,.txt" 
                    onChange={handleFileUpload} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  />
                  <div className="space-y-4">
                    <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center mx-auto">
                      <FileUp className="w-6 h-6 text-neutral-500" />
                    </div>
                    <div>
                      <p className="font-bold text-neutral-900">Upload your resume</p>
                      <p className="text-sm text-neutral-500 mt-1">PDF, DOCX, or TXT (Max 5MB)</p>
                    </div>
                    <p className="text-xs text-neutral-400">or drag and drop here</p>
                  </div>
                </div>
              ) : parsing ? (
                <div className="p-12 text-center bg-neutral-50 rounded-2xl border border-neutral-200">
                  <RefreshCw className="w-8 h-8 text-neutral-400 animate-spin mx-auto mb-4" />
                  <p className="font-bold text-neutral-900">Reading your resume...</p>
                  <p className="text-sm text-neutral-500 mt-1">Extracting experience and skills</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {fileName && (
                    <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-neutral-400" />
                        <span className="text-sm font-medium text-neutral-700">{fileName}</span>
                      </div>
                      <button 
                        onClick={() => {
                          setResumeText('');
                          setFileName(null);
                        }}
                        className="p-1 hover:bg-neutral-200 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4 text-neutral-400" />
                      </button>
                    </div>
                  )}
                  <div className="relative group">
                    <textarea 
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
                      readOnly={!isEditing}
                      placeholder="Paste your resume text here..."
                      className={cn(
                        "w-full min-h-[200px] p-6 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent outline-none transition-all resize-none font-mono text-sm",
                        !isEditing && "cursor-default"
                      )}
                    />
                    {!isEditing && (
                      <div className="absolute inset-0 bg-white/5 group-hover:bg-transparent transition-colors pointer-events-none rounded-2xl" />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex-1 space-y-4">
                <label className="text-sm font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  Target Role (Optional)
                </label>
                <input 
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. Senior Product Designer"
                  className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent outline-none transition-all"
                />
              </div>
              
              <div className="flex items-end">
                <button 
                  onClick={handleGenerate}
                  disabled={generating || !resumeText.trim()}
                  className="w-full sm:w-auto px-10 py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 shadow-lg shadow-neutral-200"
                >
                  {generating ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Zap className="w-5 h-5" />
                  )}
                  Generate Interview Prep
                </button>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-12 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm flex items-center gap-3">
            <ShieldAlert className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Results Section */}
        <div ref={resultsRef} className="min-h-[200px]">
          <AnimatePresence mode="wait">
            {generating ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-20 text-center space-y-6"
              >
                <div className="relative w-20 h-20 mx-auto">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-4 border-neutral-100 border-t-neutral-900 rounded-full"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-neutral-900 animate-pulse" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Analyzing your resume...</h3>
                  <p className="text-neutral-500">Building your custom interview strategy based on your experience.</p>
                </div>
              </motion.div>
            ) : results ? (
              <motion.div 
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-12"
              >
                {/* Role Badge */}
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="px-4 py-2 bg-neutral-900 text-white rounded-full text-sm font-bold tracking-tight">
                    Target Role: {results.targetRole || 'Not clearly shown in resume'}
                  </div>
                  <h3 className="text-3xl font-bold tracking-tight">Your Interview Strategy</h3>
                </div>

                {/* Tabs */}
                <div className="flex items-center justify-center p-1 bg-neutral-100 rounded-2xl max-w-md mx-auto">
                  {(['behavioral', 'technical', 'weakspots'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "flex-1 py-2 px-4 rounded-xl text-sm font-bold transition-all capitalize",
                        activeTab === tab ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
                      )}
                    >
                      {tab === 'weakspots' ? 'Weak Spots' : tab}
                    </button>
                  ))}
                </div>

                <div className="space-y-8">
                  {activeTab === 'behavioral' && (
                    <div className="grid gap-8">
                      {(results.behavioral || []).map((q, i) => (
                        <QuestionCard key={i} data={q} index={i} onCopy={copyToClipboard} copiedId={copiedId} />
                      ))}
                      {(!results.behavioral || results.behavioral.length === 0) && (
                        <div className="text-center py-12 text-neutral-500 bg-white rounded-3xl border border-neutral-200">
                          No behavioral questions generated.
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'technical' && (
                    <div className="grid gap-8">
                      {(results.technical || []).map((q, i) => (
                        <QuestionCard key={i} data={q} index={i} onCopy={copyToClipboard} copiedId={copiedId} />
                      ))}
                      {(!results.technical || results.technical.length === 0) && (
                        <div className="text-center py-12 text-neutral-500 bg-white rounded-3xl border border-neutral-200">
                          No technical questions generated.
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'weakspots' && (
                    <div className="grid gap-6">
                      {(results.weakSpots || []).map((spot, i) => (
                        <WeakSpotCard key={i} spot={spot} />
                      ))}
                      {(!results.weakSpots || results.weakSpots.length === 0) && (
                        <div className="text-center py-12 text-neutral-500 bg-white rounded-3xl border border-neutral-200">
                          No weak spots identified.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Confidence Boost */}
                {results.confidenceTips && results.confidenceTips.length > 0 && (
                  <div className="bg-neutral-900 text-white p-10 rounded-[2.5rem] relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <Zap className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="text-2xl font-bold mb-8 flex items-center gap-3">
                        <Zap className="w-6 h-6 text-amber-400" />
                        Before You Walk In
                      </h4>
                      <div className="grid sm:grid-cols-2 gap-8">
                        {results.confidenceTips.map((tip, i) => (
                          <div key={i} className="flex gap-4">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                              {i + 1}
                            </div>
                            <p className="text-neutral-300 text-sm leading-relaxed">{tip}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-center py-12">
                  <button 
                    onClick={() => {
                      setResults(null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-neutral-400 hover:text-neutral-900 font-medium flex items-center gap-2 mx-auto transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Start New Analysis
                  </button>
                </div>
              </motion.div>
            ) : !generating && !results && !error && (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-20 text-center border-2 border-dashed border-neutral-200 rounded-[3rem]"
              >
                <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Target className="w-8 h-8 text-neutral-300" />
                </div>
                <h3 className="text-xl font-bold text-neutral-400">Ready to prepare?</h3>
                <p className="text-neutral-400 mt-2">Upload your resume above to generate your strategy.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-[70] shadow-2xl border-l border-neutral-200 overflow-y-auto"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md">
                <h3 className="text-lg font-bold">Prep History</h3>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  <RefreshCw className="w-5 h-5 rotate-45" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                {history.length === 0 ? (
                  <div className="text-center py-12 text-neutral-400">
                    <HistoryIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No history yet. Analyze your resume!</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setResumeText(item.resumeText);
                        setTargetRole(item.targetRole);
                        setResults(item.analysis);
                        setShowHistory(false);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="w-full text-left p-4 rounded-2xl border border-neutral-100 hover:border-neutral-900 transition-all group"
                    >
                      <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">
                        {new Date(item.createdAt?.toDate()).toLocaleDateString()}
                      </p>
                      <p className="font-bold text-neutral-900 line-clamp-1 mb-1">{item.targetRole}</p>
                      <p className="text-xs text-neutral-500 line-clamp-2">{item.resumeText}</p>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <footer className="max-w-6xl mx-auto px-4 py-12 border-t border-neutral-200 text-center">
        <p className="text-neutral-400 text-sm">
          &copy; {new Date().getFullYear()} Answer For Me: Interview Mode. Grounded in your experience.
        </p>
      </footer>
    </div>
  );
}

function QuestionCard({ data, index, onCopy, copiedId }: { 
  data: QuestionSet; 
  index: number; 
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}) {
  const [activeAnswer, setActiveAnswer] = useState<'strong' | 'natural' | 'short' | 'deeper' | 'honest'>('strong');

  const answerTypes = (['strong', 'natural', 'short', 'deeper'] as const).filter(t => t === 'deeper' || data.answers[t as keyof typeof data.answers]);
  const allTypes = [...answerTypes, ...(data.answers.honest ? ['honest' as const] : [])];

  return (
    <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden group hover:border-neutral-300 transition-all">
      <div className="p-8 space-y-8">
        {/* Question Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Question {index + 1}</span>
          </div>
          <h4 className="text-xl font-bold leading-tight">{data.question}</h4>
          <div className="flex items-start gap-2 p-4 bg-neutral-50 rounded-xl text-sm text-neutral-600">
            <Info className="w-4 h-4 mt-0.5 text-neutral-400 flex-shrink-0" />
            <p><span className="font-bold text-neutral-900">Interviewer Intent:</span> {data.intent}</p>
          </div>
        </div>

        {/* Answers */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-4 overflow-x-auto no-scrollbar">
            {allTypes.map((type) => (
              <button
                key={type}
                onClick={() => setActiveAnswer(type)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold transition-all capitalize whitespace-nowrap",
                  activeAnswer === type ? "bg-neutral-900 text-white" : "text-neutral-400 hover:text-neutral-600"
                )}
              >
                {type === 'strong' ? 'STAR Structured' : 
                 type === 'deeper' ? 'If They Push Further' : 
                 type === 'honest' ? 'Best Honest Answer' : type}
              </button>
            ))}
          </div>

          <div className="relative">
            <div className="text-neutral-800 leading-relaxed whitespace-pre-wrap min-h-[100px] prose prose-neutral max-w-none">
              <ReactMarkdown>
                {activeAnswer === 'deeper' ? data.deeperAnswer : 
                 activeAnswer === 'honest' ? data.answers.honest || '' :
                 data.answers[activeAnswer as 'strong' | 'natural' | 'short']}
              </ReactMarkdown>
            </div>
            <button 
              onClick={() => onCopy(
                activeAnswer === 'deeper' ? data.deeperAnswer : 
                activeAnswer === 'honest' ? data.answers.honest || '' :
                data.answers[activeAnswer as 'strong' | 'natural' | 'short'], 
                `${index}-${activeAnswer}`
              )}
              className="absolute -top-12 right-0 p-2 text-neutral-400 hover:text-neutral-900 transition-colors"
            >
              {copiedId === `${index}-${activeAnswer}` ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Coaching Section */}
          <div className="grid sm:grid-cols-2 gap-4 pt-4">
            <div className="p-5 bg-red-50/50 rounded-2xl border border-red-100">
              <h5 className="text-xs font-bold text-red-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                <ShieldAlert className="w-3 h-3" />
                Where This Could Fall Apart
              </h5>
              <p className="text-sm text-red-800 leading-relaxed">{data.coaching.whereItFallsApart}</p>
            </div>
            <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100">
              <h5 className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Zap className="w-3 h-3" />
                How to Strengthen It
              </h5>
              <p className="text-sm text-emerald-800 leading-relaxed">{data.coaching.howToStrengthen}</p>
            </div>
          </div>

          {/* Clarity Boost */}
          <div className="p-6 bg-neutral-900 text-white rounded-2xl space-y-4">
            <h5 className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-amber-400" />
              What This Answer Shows
            </h5>
            <div className="grid sm:grid-cols-3 gap-6">
              <div>
                <p className="text-[10px] font-bold text-neutral-500 uppercase mb-1">The Skill</p>
                <p className="text-sm font-medium">{data.clarityBoost.skill}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-neutral-500 uppercase mb-1">The Signal</p>
                <p className="text-sm font-medium">{data.clarityBoost.signal}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-neutral-500 uppercase mb-1">Why It Works</p>
                <p className="text-sm font-medium">{data.clarityBoost.whyItWorks}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Follow Ups */}
        <div className="pt-6 border-t border-neutral-100">
          <h5 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <MessageSquare className="w-3 h-3" />
            Likely Follow-Ups
          </h5>
          <div className="space-y-3">
            {data.followUps.map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-neutral-500">
                <ArrowRight className="w-3 h-3 text-neutral-300" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeakSpotCard({ spot }: { spot: WeakSpot }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-neutral-200 flex gap-6">
      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
        <ShieldAlert className="w-6 h-6 text-red-500" />
      </div>
      <div className="space-y-2">
        <h4 className="font-bold text-neutral-900">{spot.area}</h4>
        <p className="text-sm text-neutral-500 leading-relaxed"><span className="font-bold text-neutral-700">Concern:</span> {spot.concern}</p>
        <div className="mt-4 p-4 bg-neutral-50 rounded-xl text-sm text-neutral-600 border border-neutral-100">
          <span className="font-bold text-neutral-900 block mb-1">Response Strategy:</span>
          {spot.responseStrategy}
        </div>
      </div>
    </div>
  );
}
