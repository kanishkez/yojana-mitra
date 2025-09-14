import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, ChevronRight, FileText, Users, Briefcase, Target, ArrowRight, Sparkles } from 'lucide-react';

const YojanaMitra = () => {
  const [currentStep, setCurrentStep] = useState('welcome');
  const [userData, setUserData] = useState({
    name: '',
    age: '',
    occupation: '',
    sector: ''
  });
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const sectors = [
    'Agriculture & Farming',
    'Education',
    'Healthcare',
    'Employment & Skill Development',
    'Women & Child Development',
    'Housing & Urban Development',
    'Rural Development',
    'Senior Citizens',
    'Disability & Welfare',
    'Business & Entrepreneurship',
    'Technology & Innovation',
    'Finance & Banking'
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputChange = (field, value) => {
    setUserData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNextStep = () => {
    if (currentStep === 'welcome') {
      setCurrentStep('questions');
    } else if (currentStep === 'questions') {
      if (userData.name && userData.age && userData.occupation && userData.sector) {
        setCurrentStep('chat');
        initializeChat();
      }
    }
  };

  const initializeChat = () => {
    const welcomeMessage = {
      id: Date.now(),
      type: 'bot',
      content: `नमस्ते ${userData.name}! I'm YojanaMitra, your AI assistant for Indian government schemes. Based on your profile (${userData.age} years, ${userData.occupation}, interested in ${userData.sector}), I'll help you discover relevant schemes and benefits.

Let me fetch personalized recommendations for you...`,
      timestamp: new Date()
    };
    
    setMessages([welcomeMessage]);
    
    // Simulate initial scheme recommendations
    setTimeout(() => {
      const schemesMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: `Based on your profile, here are some schemes that might benefit you:

🎯 **Personalized Recommendations:**
• Scheme recommendations based on your age (${userData.age}) and occupation
• ${userData.sector} specific programs
• Application guidance and eligibility criteria

You can ask me questions like:
- "What schemes are available for my age group?"
- "How do I apply for education schemes?"
- "What documents do I need?"
- "Tell me about ${userData.sector.toLowerCase()} schemes"

What would you like to know more about?`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, schemesMessage]);
    }, 2000);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    // Simulate API call to RAG system
    setTimeout(() => {
      const responses = [
        `Based on your query about "${inputMessage}", here are relevant schemes:\n\n🔹 **PM Kisan Samman Nidhi**: Direct income support for farmers\n🔹 **Pradhan Mantri Mudra Yojana**: Micro-finance for small businesses\n🔹 **Digital India Initiative**: Technology adoption schemes\n\nWould you like detailed information about any of these schemes?`,
        
        `I found several schemes matching your profile:\n\n📋 **Eligibility**: You qualify for 3 schemes\n💰 **Benefits**: Up to ₹2,00,000 in various schemes\n📄 **Documents**: Aadhaar, Income certificate needed\n\nShall I help you with the application process for any specific scheme?`,
        
        `Here's what I found in the ${userData.sector} sector:\n\n✅ **Active Schemes**: 5 schemes currently accepting applications\n📅 **Deadlines**: Next deadline is 30 days away\n🎯 **Best Match**: Based on your occupation as ${userData.occupation}\n\nClick on any scheme name for detailed eligibility criteria and application steps.`
      ];
      
      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, botMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const resetChat = () => {
    setCurrentStep('welcome');
    setUserData({ name: '', age: '', occupation: '', sector: '' });
    setMessages([]);
    setInputMessage('');
  };

  if (currentStep === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-3 bg-white px-6 py-3 rounded-full shadow-lg mb-6">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-orange-500 rounded-full flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent">
                YojanaMitra
              </h1>
            </div>
            <p className="text-xl text-gray-600 mb-2">AI-Powered Government Schemes Assistant</p>
            <p className="text-gray-500">Discover schemes that benefit you | योजनाओं का लाभ उठाएं</p>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Personalized Recommendations</h3>
              <p className="text-gray-600 text-sm">Get schemes tailored to your profile, age, and occupation</p>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Eligibility Check</h3>
              <p className="text-gray-600 text-sm">Instantly check if you qualify for various government schemes</p>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Application Guidance</h3>
              <p className="text-gray-600 text-sm">Step-by-step help with documents and application process</p>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <button
              onClick={handleNextStep}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-orange-500 text-white px-8 py-4 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300"
            >
              Get Started
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-gray-500 text-sm mt-4">Takes less than 2 minutes • Free to use</p>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'questions') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Tell us about yourself</h2>
              <p className="text-gray-600">This helps us find the most relevant schemes for you</p>
            </div>

            {/* Progress */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="space-y-6">
                {/* Name */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <User className="w-4 h-4" />
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={userData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter your full name"
                  />
                </div>

                {/* Age */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Users className="w-4 h-4" />
                    Age
                  </label>
                  <input
                    type="number"
                    value={userData.age}
                    onChange={(e) => handleInputChange('age', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter your age"
                    min="1"
                    max="120"
                  />
                </div>

                {/* Occupation */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Briefcase className="w-4 h-4" />
                    Occupation
                  </label>
                  <input
                    type="text"
                    value={userData.occupation}
                    onChange={(e) => handleInputChange('occupation', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="e.g., Student, Farmer, Teacher, Business Owner"
                  />
                </div>

                {/* Sector */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Target className="w-4 h-4" />
                    Sector of Interest
                  </label>
                  <select
                    value={userData.sector}
                    onChange={(e) => handleInputChange('sector', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="">Select a sector</option>
                    {sectors.map((sector) => (
                      <option key={sector} value={sector}>{sector}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submit Button */}
              <div className="mt-8 text-center">
                <button
                  onClick={handleNextStep}
                  disabled={!userData.name || !userData.age || !userData.occupation || !userData.sector}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-orange-500 text-white px-8 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transform hover:scale-105 transition-all duration-300"
                >
                  Find My Schemes
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-orange-500 rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">YojanaMitra</h1>
              <p className="text-sm text-gray-500">AI Schemes Assistant</p>
            </div>
          </div>
          <button
            onClick={resetChat}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            New Session
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="max-w-4xl mx-auto h-[calc(100vh-180px)] flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.type === 'user' 
                  ? 'bg-blue-600' 
                  : 'bg-gradient-to-r from-blue-600 to-orange-500'
              }`}>
                {message.type === 'user' ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-white" />
                )}
              </div>
              <div
                className={`max-w-[70%] p-4 rounded-2xl ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                <div className={`text-xs mt-2 ${
                  message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-orange-500 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white border border-gray-200 p-4 rounded-2xl">
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                  <span className="text-gray-500 text-sm">YojanaMitra is thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about schemes, eligibility, documents, or application process..."
                className="w-full p-3 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                rows={1}
                style={{ minHeight: '44px', maxHeight: '120px' }}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="bg-gradient-to-r from-blue-600 to-orange-500 text-white p-3 rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
};

export default YojanaMitra;