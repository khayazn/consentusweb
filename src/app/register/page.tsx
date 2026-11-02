"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  countriesByRegion, 
  getCurrencyForCountry 
} from "@/utils/currencyUtils";

// 1. Define the Props for the Modal to fix implicit 'any' errors
interface TermsModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

const TermsModal = ({ visible, onClose, title, content }: TermsModalProps) => {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#E2E8F0]">
          <h3 className="text-[18px] font-bold text-[#2D3748]">{title}</h3>
          <button onClick={onClose} className="text-[#2D3748] text-xl font-bold p-1">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto mb-4 flex-1">
          <p className="text-[14px] text-[#4A5568] whitespace-pre-wrap leading-relaxed">
            {content}
          </p>
        </div>
        <button 
          onClick={onClose} 
          className="w-full bg-[#6B46C1] text-white py-3.5 rounded-lg font-semibold active:opacity-80"
        >
          I Understand
        </button>
      </div>
    </div>
  );
};

// 🆕 Terms and Conditions Content
const TERMS_CONTENT = `
TERMS AND CONDITIONS

1. Acceptance of Terms
By using Consentus, you agree to be bound by these Terms and Conditions.

2. Age Requirement
You must be at least 18 years old to use Consentus. By creating an account, you confirm that you are 18 years of age or older.

3. User Conduct
You agree to:
• Treat all users with respect and dignity
• Not harass, abuse, or intimidate others
• Not use the app for any illegal or unauthorized purpose
• Not share inappropriate or offensive content
• Not impersonate any person or entity

4. Safety and Liability
• Consentus is a platform that facilitates connections
• We do not perform background checks or verify identities
• You are solely responsible for your own safety
• We are not liable for any damages or injuries arising from your use of the app
• All in-person meetings are at your own risk
• We strongly recommend meeting in public places

5. User Responsibility
• You are responsible for your interactions with other users
• You are responsible for the accuracy of your information
• You are responsible for maintaining account security
• You agree to report any violations of these terms

6. Financial Transactions
• Payment processing is handled by third-party providers
• We do not store full credit card details
• Users are responsible for payment disputes
• Banking information is optional and encrypted

7. Termination
• We reserve the right to terminate accounts for violations of these terms
• You may delete your account at any time
• Data will be deleted within 30 days of account deletion

8. Disclaimer
• The app is provided "as is" without warranties
• We do not endorse any user or guarantee suitability
• You assume all risks associated with using the app

9. Governing Law
• These terms are governed by the laws of South Africa
• Disputes will be resolved in South African courts

10. Contact
• Email: support@consentusapp.com
`;

// 🆕 Privacy Policy Content
const PRIVACY_CONTENT = `
PRIVACY POLICY

1. Information We Collect
• Account Information: Username, email, age, gender, user type
• Profile Information: Photos, bio, description, interests
• Location Information: GPS coordinates and country
• Banking Information: Optional and encrypted
• Communication Data: Messages, date requests, pinches
• Usage Data: App features used and interaction patterns

2. How We Use Your Information
• Connect you with nearby users
• Enable communication between users
• Process date requests and payments
• Improve app features and user experience
• Send notifications and updates

3. Information Sharing
• User profiles are visible to other users
• Your exact location is never shared
• Banking information is only shared with payment processors
• We never sell your personal information

4. Data Security
• All data is encrypted in transit (SSL/TLS)
• Passwords are securely hashed
• Payment data is processed by secure third-party providers
• Data is isolated and access-controlled

5. Your Rights
• Access your personal data
• Correct inaccurate data
• Delete your account and data
• Withdraw consent for data processing
• Export your data in machine-readable format

6. Data Retention
• Data is retained while your account is active
• Data is removed within 30 days of account deletion
• Some data may be retained for legal compliance

7. Children's Privacy
• Consentus is not intended for users under 18
• We do not knowingly collect data from children
• We will delete accounts of users under 18

8. International Data Transfers
• Data may be transferred to countries with different data protection laws
• By using the app, you consent to such transfers

9. Changes to This Policy
• We may update this policy from time to time
• Continued use constitutes acceptance of changes

10. Contact
• Email: support@consentusapp.com
• Data Protection Officer: dpo@consentusapp.com
`;

export default function RegisterScreen() {
  const router = useRouter();
  
  const [registrationStep, setRegistrationStep] = useState(1);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  
  // 🆕 Terms and Privacy Modal States
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  
  // 🆕 Checkbox States
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  // ✅ NEW: Verification screen states
  const [showVerificationScreen, setShowVerificationScreen] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [resendingVerification, setResendingVerification] = useState(false);

  const [profile, setProfile] = useState({
    username: "",
    email: "",
    password: "",
    age: "",
    gender: "",
    description: "",
    photos: [] as any[],
    country: "USA",
    bankName: "",
    accountHolderName: "",
    accountNumber: "",
    routingNumber: "",
    iban: "",
    swiftCode: "",
    bankCountry: "",
    currency: "USD",
    branchCode: ""
  });
  
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Update currency when country changes
  const handleCountryChange = (selectedCountry: string) => {
    const currencyInfo = getCurrencyForCountry(selectedCountry);
    setProfile({
      ...profile, 
      country: selectedCountry,
      currency: currencyInfo.code
    });
    setShowCountryPicker(false);
  };

  const handleResendVerification = async () => {
    if (resendingVerification) return;
    setResendingVerification(true);
    try {
      // Replace with your actual API call
      // await authAPI.resendVerification(registeredEmail);
      alert("A new verification email has been sent to your inbox.");
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to resend verification email.");
    } finally {
      setResendingVerification(false);
    }
  };

  const handleGoToLogin = () => {
    router.push("/login");
  };

  // Web file picker handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setUploadingPhoto(true);
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile((prev) => ({
          ...prev,
          photos: [...prev.photos, {
            uri: reader.result as string,
            type: file.type,
            name: file.name,
            base64: (reader.result as string).split(",")[1] // Extract base64 string
          }]
        }));
      };
      reader.readAsDataURL(file);
    });
    setUploadingPhoto(false);
    // Reset input
    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    const newPhotos = profile.photos.filter((_, i) => i !== index);
    setProfile({ ...profile, photos: newPhotos });
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 6;
  };

  const validateForm = () => {
    if (!profile.username || !profile.age || !profile.gender || !profile.email || !profile.password || !profile.country) {
      return "Please fill all required fields";
    }
    if (!validateEmail(profile.email)) return "Please enter a valid email address";
    if (!validatePassword(profile.password)) return "Password must be at least 6 characters long";
    if (profile.photos.length < 3) return "Please add at least 3 profile photos";
    if (profile.photos.length > 6) return "Maximum 6 photos allowed";
    if (isNaN(Number(profile.age)) || Number(profile.age) < 18 || Number(profile.age) > 100) {
      return "Please enter a valid age between 18 and 100";
    }
    if (!acceptedTerms) return "You must accept the Terms and Conditions";
    if (!acceptedPrivacy) return "You must accept the Privacy Policy";
    return null;
  };

  const createFormData = () => {
    const formData = new FormData();
    formData.append("username", profile.username);
    formData.append("email", profile.email);
    formData.append("password", profile.password);
    formData.append("age", profile.age);
    formData.append("gender", profile.gender);
    formData.append("description", profile.description || "");
    formData.append("country", profile.country);
    formData.append("currency", profile.currency); 
    formData.append("bank_name", profile.bankName || "");
    formData.append("account_holder_name", profile.accountHolderName || "");
    formData.append("account_number", profile.accountNumber || "");
    formData.append("routing_number", profile.routingNumber || "");
    formData.append("iban", profile.iban || "");
    formData.append("swift_code", profile.swiftCode || "");
    formData.append("bank_country", profile.bankCountry || "");
    formData.append("branch_code", profile.branchCode || "");
    
    profile.photos.forEach((photo, index) => {
      if (photo.uri) {
        // Convert base64 data URL to Blob for web upload
        const byteString = atob(photo.uri.split(",")[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: photo.type });
        formData.append("photos", blob, photo.name || `photo_${index}.jpg`);
      }
    });

    return formData;
  };

  const registerUser = async () => {
    const validationError = validateForm();
    if (validationError) {
      alert(validationError);
      return;
    }

    setLoading(true);
    try {
      const formData = createFormData();
      
      const response = await fetch("https://api-v1.consentus.online/api/auth/register", {
        method: "POST",
        body: formData,
        // Let the browser set the Content-Type with boundary
      });
      
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || "Registration failed");
      
      if (data.requires_verification) {
        setRegisteredEmail(profile.email);
        setShowVerificationScreen(true);
        alert("Registration Successful! 📧\n\nPlease check your email to verify your account.");
        setLoading(false);
        return;
      }
      
      // Legacy flow
      if (data.token) {
        // Handle token storage (e.g., localStorage.setItem)
      }
      
      router.push("/app"); // Navigate to main app
    } catch (error: any) {
      alert(error.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkipBanking = () => {
    setProfile(prev => ({
      ...prev,
      bankName: "", accountHolderName: "", accountNumber: "",
      routingNumber: "", iban: "", swiftCode: "", bankCountry: "", branchCode: ""
    }));
    registerUser();
  };

  const isStep1Valid = () => {
    return profile.username && profile.email && validateEmail(profile.email) && 
           profile.password && validatePassword(profile.password) && profile.age && 
           profile.gender && profile.country && profile.photos.length >= 3 && 
           profile.photos.length <= 6 && acceptedTerms && acceptedPrivacy;
  };

  const getPhotoStatusMessage = () => {
    if (profile.photos.length === 0) return "No photos added yet";
    if (profile.photos.length < 3) return `${3 - profile.photos.length} more photo${profile.photos.length === 2 ? "" : "s"} needed (minimum 3)`;
    if (profile.photos.length < 6) return `${6 - profile.photos.length} more photo${6 - profile.photos.length === 1 ? "" : "s"} can be added (maximum 6)`;
    if (profile.photos.length === 6) return "Maximum photos reached (6/6)";
    return "";
  };

  // ✅ Verification Screen
  if (showVerificationScreen) {
    return (
      <div className="min-h-screen bg-[#F7FAFC] flex items-center justify-center p-5">
        <div className="bg-white rounded-2xl p-8 w-full max-w-md text-center shadow-lg">
          <div className="text-6xl mb-5">📧</div>
          <h2 className="text-2xl font-bold text-[#2D3748] mb-2">Verify Your Email</h2>
          <p className="text-[16px] text-[#718096] mb-1">We've sent a verification link to:</p>
          <p className="text-[18px] font-semibold text-[#6B46C1] mb-4">{registeredEmail}</p>
          <p className="text-[14px] text-[#4A5568] leading-relaxed mb-6">
            Please check your inbox and click the verification link to activate your account.
          </p>
          
          <button 
            onClick={handleResendVerification}
            disabled={resendingVerification}
            className={`w-full bg-[#6B46C1] text-white py-3.5 rounded-lg font-semibold mb-3 ${resendingVerification ? "opacity-70 cursor-not-allowed" : "active:opacity-80"}`}
          >
            {resendingVerification ? "Sending..." : "Resend Verification Email"}
          </button>
          
          <button 
            onClick={handleGoToLogin}
            className="w-full text-[#6B46C1] font-medium py-3 mb-4"
          >
            Back to Login
          </button>
          
          <p className="text-[12px] text-[#E53E3E]">
            ⚠️ You won't be able to log in until your email is verified.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7FAFC] pb-10">
      {/* Modals */}
      <TermsModal
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        title="Terms and Conditions"
        content={TERMS_CONTENT}
      />
      <TermsModal
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        title="Privacy Policy"
        content={PRIVACY_CONTENT}
      />

      {/* Country Picker Modal */}
      {showCountryPicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#E2E8F0]">
              <h3 className="text-[18px] font-bold text-[#2D3748]">Select Your Country</h3>
              <button onClick={() => setShowCountryPicker(false)} className="text-[#2D3748] text-xl font-bold">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 pr-2">
              {Object.entries(countriesByRegion).map(([region, countries]) => (
                <div key={region} className="mb-5">
                  <h4 className="text-[16px] font-semibold text-[#6B46C1] bg-[#F0F4FF] px-3 py-2 rounded-lg mb-2">
                    {region}
                  </h4>
                  {/* 2. Added 'as string[]' to fix the 'countries' unknown error */}
                  {(countries as string[]).map((country) => {
                    const currencyInfo = getCurrencyForCountry(country);
                    const isSelected = profile.country === country;
                    return (
                      <button
                        key={country}
                        onClick={() => handleCountryChange(country)}
                        className={`w-full flex justify-between items-center p-3 border-b border-[#E2E8F0] text-left ${
                          isSelected ? "bg-[#6B46C1] rounded-lg border-transparent mb-1 text-white" : ""
                        }`}
                      >
                        <div>
                          <p className={`text-[16px] mb-0.5 ${isSelected ? "text-white" : "text-[#2D3748]"}`}>{country}</p>
                          <p className={`text-[12px] ${isSelected ? "text-[#E2E8F0]" : "text-[#718096]"}`}>
                            {currencyInfo.code} ({currencyInfo.symbol})
                          </p>
                        </div>
                        {isSelected && <span className="text-white">✓</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="p-5 pt-12 max-w-2xl mx-auto">
        <button onClick={() => router.back()} className="text-[#6B46C1] text-[16px] font-semibold mb-5 active:opacity-70">
          ← Back
        </button>
        <h1 className="text-[28px] font-bold text-[#FF6B6B] text-center mb-2">✨ Consentus</h1>
        <p className="text-[16px] text-[#666] text-center mb-2">
          {registrationStep === 1 ? "Create Your Profile" : "Banking Details"}
        </p>
        <p className="text-[14px] text-[#999] italic text-center">
          Step {registrationStep} of 2
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {registrationStep === 1 ? (
          <>
            {/* Basic Information */}
            <div className="bg-white p-5 rounded-xl shadow-sm mb-4">
              <h2 className="text-[20px] font-bold text-[#2D3748] text-center mb-4">Basic Information</h2>
              
              <input
                type="text"
                placeholder="Username *"
                value={profile.username}
                onChange={(e) => setProfile({ ...profile, username: e.target.value.trim() })}
                className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg p-3 mb-2 text-[16px] text-[#2D3748] focus:outline-none focus:border-[#6B46C1]"
              />
              
              <div className="mb-2">
                <input
                  type="email"
                  placeholder="Email *"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value.trim() })}
                  className={`w-full bg-[#F7FAFC] border rounded-lg p-3 text-[16px] text-[#2D3748] focus:outline-none ${
                    profile.email && !validateEmail(profile.email) ? "border-[#E53E3E] focus:border-[#E53E3E]" : "border-[#E2E8F0] focus:border-[#6B46C1]"
                  }`}
                />
                {profile.email && !validateEmail(profile.email) && (
                  <p className="text-[#E53E3E] text-[12px] mt-1">Please enter a valid email address</p>
                )}
              </div>
              
              <div className="mb-2">
                <input
                  type="password"
                  placeholder="Password * (min. 6 characters)"
                  value={profile.password}
                  onChange={(e) => setProfile({ ...profile, password: e.target.value })}
                  className={`w-full bg-[#F7FAFC] border rounded-lg p-3 text-[16px] text-[#2D3748] focus:outline-none ${
                    profile.password && !validatePassword(profile.password) ? "border-[#E53E3E] focus:border-[#E53E3E]" : "border-[#E2E8F0] focus:border-[#6B46C1]"
                  }`}
                />
                {profile.password && !validatePassword(profile.password) && (
                  <p className="text-[#E53E3E] text-[12px] mt-1">Password must be at least 6 characters</p>
                )}
              </div>
              
              <div className="mb-2">
                <input
                  type="number"
                  placeholder="Age * (18+)"
                  value={profile.age}
                  onChange={(e) => setProfile({ ...profile, age: e.target.value.replace(/[^0-9]/g, "") })}
                  className={`w-full bg-[#F7FAFC] border rounded-lg p-3 text-[16px] text-[#2D3748] focus:outline-none ${
                    profile.age && (Number(profile.age) < 18 || Number(profile.age) > 100) ? "border-[#E53E3E] focus:border-[#E53E3E]" : "border-[#E2E8F0] focus:border-[#6B46C1]"
                  }`}
                />
                {profile.age && (Number(profile.age) < 18 || Number(profile.age) > 100) && (
                  <p className="text-[#E53E3E] text-[12px] mt-1">Age must be between 18 and 100</p>
                )}
              </div>
              
              <div className="flex gap-2 mb-3">
                {["male", "female"].map((gender) => (
                  <button
                    key={gender}
                    onClick={() => setProfile({ ...profile, gender })}
                    className={`flex-1 py-3 rounded-lg font-medium text-[16px] border ${
                      profile.gender === gender 
                        ? "bg-[#6B46C1] border-[#6B46C1] text-white" 
                        : "bg-[#F7FAFC] border-[#E2E8F0] text-[#718096]"
                    }`}
                  >
                    {gender.charAt(0).toUpperCase() + gender.slice(1)}
                  </button>
                ))}
              </div>

              {/* Country Selection */}
              <button
                onClick={() => setShowCountryPicker(true)}
                className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg p-3 mb-3 flex justify-between items-center active:opacity-80"
              >
                <div className="text-left">
                  <p className="text-[12px] text-[#718096] mb-1">Country *</p>
                  <p className="text-[16px] text-[#2D3748] font-medium">{profile.country}</p>
                  <p className="text-[12px] text-[#6B46C1] mt-0.5">
                    {profile.currency} ({getCurrencyForCountry(profile.country).symbol})
                  </p>
                </div>
                <span className="text-[#6B46C1]">⌄</span>
              </button>
              
              <textarea
                placeholder="Describe yourself... What makes you unique?"
                value={profile.description}
                onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg p-3 text-[16px] text-[#2D3748] min-h-[80px] focus:outline-none focus:border-[#6B46C1]"
              />
            </div>

            {/* Photos */}
            <div className="bg-white p-5 rounded-xl shadow-sm mb-4">
              <h2 className="text-[20px] font-bold text-[#2D3748] text-center mb-2">Profile Photos *</h2>
              <p className="text-[14px] text-[#718096] text-center mb-4">
                Add 3-6 real photos to complete your profile
              </p>
              
              <div className="flex flex-wrap gap-3">
                {profile.photos.map((photo, index) => (
                  <div key={index} className="relative w-[30%] aspect-square mb-2">
                    <img src={photo.uri} alt="profile" className="w-full h-full object-cover rounded-lg" />
                    <button
                      onClick={() => removePhoto(index)}
                      disabled={uploadingPhoto}
                      className="absolute -top-2 -right-2 bg-[#FF6B6B] text-white w-6 h-6 rounded-full flex items-center justify-center font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {profile.photos.length < 6 && (
                  <label className="w-[30%] aspect-square bg-[#EDF2F7] rounded-lg border-2 border-dashed border-[#6B46C1] flex flex-col items-center justify-center cursor-pointer">
                    {uploadingPhoto ? (
                      <span className="text-[#6B46C1] text-sm">Wait...</span>
                    ) : (
                      <>
                        <span className="text-[24px] text-[#6B46C1]">📷</span>
                        <span className="text-[12px] text-[#6B46C1] font-medium mt-1">Add Photo</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploadingPhoto || profile.photos.length >= 6}
                    />
                  </label>
                )}
              </div>
              
              <p className="text-[14px] text-[#4A5568] text-center mt-3 mb-2 font-medium">
                {getPhotoStatusMessage()}
              </p>
              
              <div className="flex justify-center gap-1 mt-2">
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <div
                    key={num}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold border ${
                      profile.photos.length >= num
                        ? "bg-[#6B46C1] border-[#6B46C1] text-white"
                        : num <= 3
                        ? "bg-[#EDF2F7] border-2 border-[#FF6B6B] text-[#718096]"
                        : "bg-[#EDF2F7] border-[#E2E8F0] text-[#718096]"
                    }`}
                  >
                    {num}
                  </div>
                ))}
              </div>
            </div>

            {/* Agreements */}
            <div className="bg-white p-5 rounded-xl shadow-sm mb-4">
              <h2 className="text-[20px] font-bold text-[#2D3748] text-center mb-2">Agreements</h2>
              <p className="text-[14px] text-[#718096] text-center mb-4">Please read and accept our terms</p>

              <div className="flex items-start mb-3">
                <button
                  onClick={() => setAcceptedTerms(!acceptedTerms)}
                  className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 mr-3 mt-0.5 ${
                    acceptedTerms ? "bg-[#6B46C1] border-[#6B46C1] text-white" : "bg-white border-[#CBD5E0]"
                  }`}
                >
                  {acceptedTerms && "✓"}
                </button>
                <p className="text-[14px] text-[#4A5568] leading-tight">
                  I have read and agree to the{" "}
                  <button onClick={() => setShowTermsModal(true)} className="text-[#6B46C1] font-semibold underline">
                    Terms and Conditions
                  </button>
                </p>
              </div>

              <div className="flex items-start mb-3">
                <button
                  onClick={() => setAcceptedPrivacy(!acceptedPrivacy)}
                  className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 mr-3 mt-0.5 ${
                    acceptedPrivacy ? "bg-[#6B46C1] border-[#6B46C1] text-white" : "bg-white border-[#CBD5E0]"
                  }`}
                >
                  {acceptedPrivacy && "✓"}
                </button>
                <p className="text-[14px] text-[#4A5568] leading-tight">
                  I have read and agree to the{" "}
                  <button onClick={() => setShowPrivacyModal(true)} className="text-[#6B46C1] font-semibold underline">
                    Privacy Policy
                  </button>
                </p>
              </div>

              <div className="flex items-start">
                <div className="w-6 h-6 rounded bg-[#48BB78] border-2 border-[#48BB78] text-white flex items-center justify-center shrink-0 mr-3 mt-0.5">
                  ✓
                </div>
                <p className="text-[14px] text-[#4A5568] leading-tight">
                  I confirm that I am <span className="text-[#6B46C1] font-semibold">18 years or older</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => { if (isStep1Valid()) setRegistrationStep(2); }}
              disabled={!isStep1Valid() || loading || uploadingPhoto}
              className={`w-full py-4 rounded-lg font-bold text-[16px] mb-3 ${
                !isStep1Valid() || loading || uploadingPhoto
                  ? "bg-[#CBD5E0] text-white opacity-70 cursor-not-allowed"
                  : "bg-[#6B46C1] text-white active:opacity-80"
              }`}
            >
              {profile.photos.length < 3 
                ? `Add ${3 - profile.photos.length} more photos` 
                : "Next - Banking Details →"}
            </button>

            <button
              onClick={() => router.push("/login")}
              disabled={loading || uploadingPhoto}
              className="w-full py-4 rounded-lg bg-[#EDF2F7] text-[#4A5568] font-medium text-[16px] active:opacity-80"
            >
              Already have an account? Login
            </button>
          </>
        ) : (
                    /* Step 2: Banking */
          <div className="bg-white p-5 rounded-xl shadow-sm mb-4">
            <h2 className="text-[20px] font-bold text-[#2D3748] text-center mb-2">Banking Details (Optional)</h2>
            <p className="text-[14px] text-[#718096] text-center mb-4">
              Add your banking information to receive payments. You can skip this and add it later.
            </p>
            
            <input type="text" placeholder="Bank Name" value={profile.bankName} onChange={(e) => setProfile({ ...profile, bankName: e.target.value })} className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg p-3 mb-2 text-[16px] focus:outline-none focus:border-[#6B46C1]" />
            <input type="text" placeholder="Account Holder Name" value={profile.accountHolderName} onChange={(e) => setProfile({ ...profile, accountHolderName: e.target.value })} className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg p-3 mb-2 text-[16px] focus:outline-none focus:border-[#6B46C1]" />
            <input type="text" placeholder="Account Number" value={profile.accountNumber} onChange={(e) => setProfile({ ...profile, accountNumber: e.target.value })} className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg p-3 mb-2 text-[16px] focus:outline-none focus:border-[#6B46C1]" />
            <input type="text" placeholder="Routing Number (US)" value={profile.routingNumber} onChange={(e) => setProfile({ ...profile, routingNumber: e.target.value })} className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg p-3 mb-2 text-[16px] focus:outline-none focus:border-[#6B46C1]" />
            <input type="text" placeholder="Branch Code" value={profile.branchCode} onChange={(e) => setProfile({ ...profile, branchCode: e.target.value })} className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg p-3 mb-2 text-[16px] focus:outline-none focus:border-[#6B46C1]" />
            <input type="text" placeholder="IBAN (International)" value={profile.iban} onChange={(e) => setProfile({ ...profile, iban: e.target.value.toUpperCase() })} className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg p-3 mb-2 text-[16px] focus:outline-none focus:border-[#6B46C1]" />
            <input type="text" placeholder="SWIFT/BIC Code" value={profile.swiftCode} onChange={(e) => setProfile({ ...profile, swiftCode: e.target.value.toUpperCase() })} className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg p-3 mb-2 text-[16px] focus:outline-none focus:border-[#6B46C1]" />
            <input type="text" placeholder="Bank Country" value={profile.bankCountry} onChange={(e) => setProfile({ ...profile, bankCountry: e.target.value })} className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg p-3 mb-2 text-[16px] focus:outline-none focus:border-[#6B46C1]" />

            <div className="bg-[#EDF2F7] border border-[#E2E8F0] rounded-lg p-3 mb-4">
              <p className="text-[12px] text-[#718096] mb-1">Currency</p>
              <p className="text-[16px] text-[#2D3748] font-medium">
                {profile.currency} ({getCurrencyForCountry(profile.country).symbol})
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={() => setRegistrationStep(1)} disabled={loading} className="flex-1 py-3 rounded-lg bg-[#EDF2F7] text-[#4A5568] font-medium active:opacity-80">
                ← Back
              </button>
              <button onClick={handleSkipBanking} disabled={loading} className="flex-1 py-3 rounded-lg bg-[#EDF2F7] text-[#4A5568] font-medium active:opacity-80">
                Skip Banking
              </button>
              <button onClick={registerUser} disabled={loading} className={`flex-1 py-3 rounded-lg font-bold text-white ${loading ? "bg-[#CBD5E0] cursor-not-allowed" : "bg-[#6B46C1] active:opacity-80"}`}>
                {loading ? "Loading..." : "Complete Registration"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}