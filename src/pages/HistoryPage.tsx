import RecordHistory from '../components/RecordHistory';
import type { Plant } from '../types/plant';
import type { DailyPlantRecord } from '../types/record';

type HistoryPageProps = {
  plants: Plant[];
  records: DailyPlantRecord[];
  formatDateTime: (isoString: string) => string;
};

function HistoryPage({ plants, records, formatDateTime }: HistoryPageProps) {
  return (
    <RecordHistory
      records={records}
      plants={plants}
      formatDateTime={formatDateTime}
    />
  );
}

export default HistoryPage;
