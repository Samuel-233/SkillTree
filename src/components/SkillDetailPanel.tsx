import React from 'react';
import { type CytoscapeChildSkillNodeData, type ResourceLink } from '../helpers/node'; // Adjust path as needed
import './SkillDetailPanel.css'; // Create a CSS file for styling

interface SkillDetailPanelProps {
  skillData: CytoscapeChildSkillNodeData | null;
  isVisible: boolean;
  onClose: () => void;
}

export const SkillDetailPanel: React.FC<SkillDetailPanelProps> = ({ skillData, isVisible, onClose }) => {
  if (!isVisible || !skillData) {
    return null;
  }

  return (
    <div className="skill-detail-panel">
      <button onClick={onClose} className="close-button">X</button>
      <h2>{skillData.label}</h2> {/* `label` is the skill's name */}
      
      {skillData.description && (
        <div className="detail-section">
          <h3>Description</h3>
          <p>{skillData.description}</p>
        </div>
      )}

      {skillData.wiki && (
        <div className="detail-section">
          <h3>Wikipedia</h3>
          <p><a href={skillData.wiki} target="_blank" rel="noopener noreferrer">{skillData.wiki}</a></p>
        </div>
      )}

      {skillData.resources && skillData.resources.length > 0 && (
        <div className="detail-section">
          <h3>Other Relevant Links</h3>
          <ul>
            {skillData.resources.map((resource: ResourceLink, index: number) => (
              <li key={index}>
                <a href={resource.link} target="_blank" rel="noopener noreferrer">
                  {resource.description || resource.link} {/* Use description as link text if available */}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};