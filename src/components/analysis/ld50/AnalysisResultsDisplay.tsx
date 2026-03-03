import React, { useState, useEffect } from 'react';
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/solid';
import JSZip from 'jszip';
import { type DisplayJob } from '../../../types';
import { generateDataHash } from '../../../utils/hash';
import { ProvenanceAndDownload } from '../ProvenanceAndDownload';
import SecureDataDisplay from '../SecureDataDisplay';

type ResultsDisplayJob = Pick<
  DisplayJob,
  'projectId' | 'state' | 'returnvalue' | 'logData' | 'inputDataHash' | 'metadata'
>;

interface AnalysisResultsDisplayProps {
  job: ResultsDisplayJob;
  isLoading?: boolean;
}

export const AnalysisResultsDisplay: React.FC<AnalysisResultsDisplayProps> = ({ job, isLoading }) => {
  const [plotUrl, setPlotUrl] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any | null>(null);
  const [metadata, setMetadata] = useState<any | null>(null);
  const [secureDataInfo, setSecureDataInfo] = useState<any | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFetchingFromIPFS, setIsFetchingFromIPFS] = useState(false);

  useEffect(() => {
    setPlotUrl(null);
    setMetrics(null);
    setMetadata(null);
    setSecureDataInfo(null);
    setFetchError(null);
    setIsFetchingFromIPFS(false);

    if (job.state === 'completed' && job.returnvalue?.status === 'success') {
      setPlotUrl(job.returnvalue.results.plot_b64);
      setMetrics(job.returnvalue.results);
      setMetadata({
        input_data_hash_sha256: job.inputDataHash,
        analysis_agent: 'KintaGen LD50 Agent v1.0 (Local Run)',
      });
      return;
    }

    if (job.state === 'logged' && job.logData?.ipfsHash) {
      if (job.returnvalue?.results) {
        setMetrics(job.returnvalue.results);
        setPlotUrl(job.returnvalue.results.plot_b64);
        const knownMetadata = job.metadata || {
          input_data_hash_sha256: job.inputDataHash,
          analysis_agent: 'KintaGen LD50 Agent v1.0',
        };
        setMetadata(knownMetadata);
        setSecureDataInfo(job.returnvalue?.secureDataInfo || knownMetadata?.secure_data || null);
        return;
      }

      const fetchAndParseZip = async () => {
        setIsFetchingFromIPFS(true);
        setFetchError(null);
        try {
          const response = await fetch(`https://scarlet-additional-rabbit-987.mypinata.cloud/ipfs/${job.logData.ipfsHash}`);
          if (!response.ok) throw new Error(`Failed to fetch from IPFS (status: ${response.status})`);

          const zipBlob = await response.blob();
          const zip = await JSZip.loadAsync(zipBlob);

          const metricsFile = zip.file('ld50_metrics.json');
          if (metricsFile) {
            const metricsContent = await metricsFile.async('string');
            setMetrics(JSON.parse(metricsContent));
          } else {
            throw new Error("'ld50_metrics.json' not found in the ZIP archive.");
          }

          const plotFile = zip.file('ld50_plot.png');
          if (plotFile) {
            const plotBase64 = await plotFile.async('base64');
            setPlotUrl(`data:image/png;base64,${plotBase64}`);
          } else {
            throw new Error("'ld50_plot.png' not found in the ZIP archive.");
          }

          const metadataFile = zip.file('metadata.json');
          if (metadataFile) {
            const parsedMetadata = JSON.parse(await metadataFile.async('string'));
            setMetadata(parsedMetadata);
            setSecureDataInfo(parsedMetadata?.secure_data || null);
          } else {
            setMetadata({
              input_data_hash_sha256: job.inputDataHash,
              analysis_agent: 'KintaGen LD50 Agent v1.0',
            });
          }
        } catch (error: any) {
          console.error('Error fetching/parsing IPFS data:', error);
          setFetchError(error.message);
        } finally {
          setIsFetchingFromIPFS(false);
        }
      };
      fetchAndParseZip();
    }
  }, [job]);

  const handleDownload = async () => {
    if (job.state === 'logged' && job.logData?.ipfsHash) {
      window.open(`https://scarlet-additional-rabbit-987.mypinata.cloud/ipfs/${job.logData.ipfsHash}?download=true`, '_blank');
      return;
    }

    if (job.state === 'completed' && metrics && plotUrl && metadata) {
      try {
        const zip = new JSZip();
        const metricsJsonString = JSON.stringify(metrics, null, 2);
        const plotBase64 = plotUrl.split(',')[1];

        zip.file('ld50_metrics.json', metricsJsonString);
        zip.file('ld50_plot.png', plotBase64, { base64: true });

        const downloadMetadata = {
          schema_version: '1.1.0',
          analysis_agent: metadata.analysis_agent || 'KintaGen LD50 Agent v1.0 (Local Run)',
          timestamp_utc: new Date().toISOString(),
          input_data_hash_sha256: metadata.input_data_hash_sha256 || job.inputDataHash || 'N/A',
          outputs: [
            { filename: 'ld50_metrics.json', hash_sha256: await generateDataHash(metricsJsonString) },
            { filename: 'ld50_plot.png', hash_sha256: await generateDataHash(plotBase64) },
          ],
        };

        zip.file('metadata.json', JSON.stringify(downloadMetadata, null, 2));

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `KintaGen_LD50_Artifact_${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      } catch (error) {
        console.error('Failed to create or download ZIP file:', error);
      }
    }
  };

  if (isLoading || isFetchingFromIPFS) {
    return (
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-center my-8">
        <ArrowPathIcon className="h-8 w-8 mx-auto animate-spin text-blue-400 mb-4" />
        <p className="text-lg text-gray-300">
          {isLoading ? 'Logging results to the blockchain...' : 'Fetching results from IPFS...'}
        </p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg my-8 flex items-start space-x-3">
        <ExclamationTriangleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold">Could not load results from IPFS</h3>
          <p className="text-sm">{fetchError}</p>
        </div>
      </div>
    );
  }

  if (!metrics || !plotUrl) {
    return null;
  }

  return (
    <div className="space-y-8 my-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-6 border-b border-gray-700 pb-3">Key Metrics</h2>
          <div className="space-y-4">
            {(['ld50_estimate', 'standard_error', 'confidence_interval_lower', 'confidence_interval_upper'] as const).map(key => (
              <div key={key} className="flex justify-between items-baseline">
                <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}:</span>
                <span className="font-mono text-lg text-white">{metrics[key]?.toFixed(4) ?? 'N/A'}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col items-center justify-center min-h-[300px]">
          <h2 className="text-xl font-semibold mb-4 text-center">Dose-Response Plot</h2>
          <img src={plotUrl} alt="LD50 Dose-Response Curve" className="w-full h-auto rounded-lg bg-white p-1" />
        </div>
      </div>

      {secureDataInfo && <SecureDataDisplay secureDataInfo={secureDataInfo} />}

      <ProvenanceAndDownload
        job={job as DisplayJob}
        metadata={metadata}
        onDownload={handleDownload}
      />
    </div>
  );
};
