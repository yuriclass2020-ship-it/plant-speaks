import { useState } from 'react';
import { useNavigate } from 'react-router-dom-dom';
import PlantRegisterForm from '../components/PlantRegisterForm';

type PlantRegisterPageProps = {
  onAddPlant: (plantName: string, classroomName: string) => string;
};

function PlantRegisterPage({ onAddPlant }: PlantRegisterPageProps) {
  const navigate = useNavigate();
  const [plantName, setPlantName] = useState('');
  const [classroomName, setClassroomName] = useState('');

  return (
    <PlantRegisterForm
      plantName={plantName}
      classroomName={classroomName}
      onPlantNameChange={setPlantName}
      onClassroomNameChange={setClassroomName}
      onSubmit={(e) => {
        e.preventDefault();
        const newId = onAddPlant(plantName, classroomName);
        setPlantName('');
        setClassroomName('');
        navigate(`/plants/${newId}`);
      }}
    />
  );
}

export default PlantRegisterPage;
