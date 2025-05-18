import React from 'react';
import type { NodeSingular } from 'cytoscape';

// Re-define FoundNode here or import from App.tsx if you move it to a types file
interface FoundNode {
  id: string;
  label: string;
  node: NodeSingular;
}

interface SearchPanelProps {
  searchTerm: string;
  onSearchTermChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchKeyPress: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onPerformSearch: () => void;
  onFitGraph: () => void;
  searchResults: FoundNode[];
  onSearchResultClick: (foundNode: FoundNode) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  searchTerm,
  onSearchTermChange,
  onSearchKeyPress,
  onPerformSearch,
  onFitGraph,
  searchResults,
  onSearchResultClick,
}) => {
  return (
    <div className="control-panel">
      <div className="search-input-container">
        <input
          type="text"
          placeholder="Search node..."
          value={searchTerm}
          onChange={onSearchTermChange}
          onKeyPress={onSearchKeyPress}
          className="search-input"
        />
        <button onClick={onPerformSearch} className="button button-primary">
          Search
        </button>
      </div>
      <button onClick={onFitGraph} className="button button-success">
        Fit to Screen
      </button>
      {searchResults.length > 0 && (
        <div className="search-results-container">
          <ul className="search-results-list">
            {searchResults.map((item) => (
              <li
                key={item.id}
                onClick={() => onSearchResultClick(item)}
                className={`search-result-item ${item.node.selected() ? 'selected' : ''}`}
                title={item.label}
              >
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};