 import { Toaster } from "@/components/ui/toaster";
 import { Toaster as Sonner } from "@/components/ui/sonner";
 import { TooltipProvider } from "@/components/ui/tooltip";
 import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
 import { BrowserRouter, Routes, Route } from "react-router-dom";
 import { UserInfoProvider } from "./contexts/AuthContext";
 import Landing from "./pages/Landing";
 import Auth from "./pages/Auth";
 import Chatbot from "./pages/Chatbot";
 import Recommendations from "./pages/Recommendations";
 import NotFound from "./pages/NotFound";

 const queryClient = new QueryClient();

 const App = () => (
   <QueryClientProvider client={queryClient}>
     <TooltipProvider>
       <Toaster />
       <Sonner />
       <UserInfoProvider>
         <BrowserRouter>
           <Routes>
             <Route path="/" element={<Landing />} />
             <Route path="/auth" element={<Auth />} />
             <Route path="/chatbot" element={<Chatbot />} />
             <Route path="/recommendations" element={<Recommendations />} />
             {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
             <Route path="*" element={<NotFound />} />
           </Routes>
         </BrowserRouter>
       </UserInfoProvider>
     </TooltipProvider>
   </QueryClientProvider>
 );

 export default App;
