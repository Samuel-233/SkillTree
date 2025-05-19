import React, { useState, useRef, useEffect } from 'react';
import type { LanguageCode } from '../config.ts'; // Adjust path if App.tsx is elsewhere or config is separate

interface SettingsMenuProps {
  currentLanguage: LanguageCode;
  availableLanguages: { code: LanguageCode; name: string }[];
  onLanguageChange: (newLanguage: LanguageCode) => void;
  // Add other settings props here later if needed
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  currentLanguage,
  availableLanguages,
  onLanguageChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => setIsOpen(!isOpen);

  const handleLanguageSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onLanguageChange(event.target.value as LanguageCode);
    setIsOpen(false); // Close menu after selection
  };

  // Close menu if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuRef]);

  return (
    <div className="settings-container" ref={menuRef}>
      <button onClick={toggleMenu} className="settings-gear-button" aria-label="Settings">
        ⚙️
      </button>
      {isOpen && (
        <div className="settings-menu">
          <div className="settings-menu-item">
            <label htmlFor="language-select">Language:</label>
            <select
              id="language-select"
              value={currentLanguage}
              onChange={handleLanguageSelect}
            >
              {availableLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
          {/* Add other settings options here */}
        </div>
      )}
    </div>
  );
};