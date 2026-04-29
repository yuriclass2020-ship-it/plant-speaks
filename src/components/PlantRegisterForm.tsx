import type { FormEventHandler } from 'react';
import type { PlantSpeciesKey } from '../types/plantSpecies';
import { plantSpeciesPresets } from '../data/plantSpeciesPresets';

type PlantRegisterFormProps = {
  plantName: string;
  classroomName: string;
  speciesKey: PlantSpeciesKey | '';
  onPlantNameChange: (value: string) => void;
  onClassroomNameChange: (value: string) => void;
  onSpeciesKeyChange: (value: PlantSpeciesKey | '') => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

function PlantRegisterForm({
  plantName,
  classroomName,
  speciesKey,
  onPlantNameChange,
  onClassroomNameChange,
  onSpeciesKeyChange,
  onSubmit,
}: PlantRegisterFormProps) {
  return (
    <section className="section-card">
      <h2 className="section-title">식물 등록</h2>

      <form onSubmit={onSubmit}>
        <div className="form-field">
          <label htmlFor="speciesKey" className="form-label">
            식물 종류
          </label>
          <select
            id="speciesKey"
            value={speciesKey}
            onChange={(e) => onSpeciesKeyChange(e.target.value as PlantSpeciesKey | '')}
            className="form-select"
          >
            <option value="">식물 종류를 선택해 주세요</option>
            {plantSpeciesPresets.map((preset) => (
              <option key={preset.key} value={preset.key}>
                {preset.emoji} {preset.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="plantName" className="form-label">
            식물 이름
          </label>
          <input
            id="plantName"
            type="text"
            value={plantName}
            onChange={(e) => onPlantNameChange(e.target.value)}
            placeholder="예: 초록이, 토마토 친구"
            className="form-input"
          />
        </div>

        <div className="form-field-large">
          <label htmlFor="classroomName" className="form-label">
            반 이름
          </label>
          <input
            id="classroomName"
            type="text"
            value={classroomName}
            onChange={(e) => onClassroomNameChange(e.target.value)}
            placeholder="예: 햇살반"
            className="form-input"
          />
        </div>

        <button type="submit" className="primary-button">
          식물 등록하기
        </button>
      </form>
    </section>
  );
}

export default PlantRegisterForm;
