import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../config";


export default function FirmwareManagement() {
  const [version, setVersion] = useState("");
  const [file, setFile] = useState(null);
  const [firmwares, setFirmwares] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [targetGroup, setTargetGroup] = useState("");

  const fetchFirmwares = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/firmware`);
      const data = await res.json();
      setFirmwares(data);
    } catch (error) {
      console.error("Error fetching firmware list:", error);
    }
  };

  useEffect(() => {
    fetchFirmwares();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!version || !file) {
      alert("Please enter version and select firmware file");
      return;
    }

    const formData = new FormData();
    formData.append("version", version);
    formData.append("firmware", file);
    formData.append("target_group", targetGroup);

    try {
      setUploading(true);

      const res = await fetch(`${API_BASE_URL}/api/firmware/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        alert("Firmware uploaded successfully");
        setVersion("");
        setFile(null);
        fetchFirmwares();
      } else {
        alert(data.message || "Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload error");
    } finally {
      setUploading(false);
    }
  };

  const setAsLatest = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/firmware/${id}/latest`, {
        method: "PUT",
      });

      const data = await res.json();

      if (res.ok) {
        alert("Firmware marked as latest");
        fetchFirmwares();
      } else {
        alert(data.message || "Failed to update latest firmware");
      }
    } catch (error) {
      console.error("Error updating latest firmware:", error);
      alert("Error updating latest firmware");
    }
  };

  return (
    <div className="p-6 text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Firmware Management</h1>

        <Link
          to="/"
          className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
        >
          Back to Dashboard
        </Link>
      </div>

      <form
        onSubmit={handleUpload}
        className="bg-slate-900 p-5 rounded-xl border border-slate-800 mb-8"
      >
        <h2 className="text-xl font-semibold mb-4">Upload New Firmware</h2>

        <div className="mb-4">
          <label className="block mb-2">Firmware Version</label>

          <input
            type="text"
            placeholder="Example: 1.0.3"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="w-full p-3 rounded bg-slate-800 border border-slate-700"
          />

          <input
            type="text"
            placeholder="Target Group"
            value={targetGroup}
            onChange={(e) => setTargetGroup(e.target.value)}
            className="bg-slate-800 text-white px-3 py-2 rounded"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-2">Firmware .bin File</label>
          <input
            type="file"
            accept=".bin"
            onChange={(e) => setFile(e.target.files[0])}
            className="w-full p-3 rounded bg-slate-800 border border-slate-700"
          />
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-lg"
        >
          {uploading ? "Uploading..." : "Upload Firmware"}
        </button>
      </form>

      <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
        <h2 className="text-xl font-semibold mb-4">Firmware Versions</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-800">
              <tr>
                <th className="p-3">Version</th>
                <th className="p-3">File URL</th>
                <th className="p-3">Latest</th>
                <th className="p-3">Uploaded At</th>
              </tr>
            </thead>

            <tbody>
              {firmwares.length === 0 ? (
                <tr>
                  <td className="p-3" colSpan="4">
                    No firmware uploaded yet.
                  </td>
                </tr>
              ) : (
                firmwares.map((fw) => (
                  <tr key={fw.id} className="border-t border-slate-800">
                    <td className="p-3">{fw.version}</td>

                    <td className="p-3 text-blue-400">
                      <a href={fw.file_url} target="_blank" rel="noreferrer">
                        Download
                      </a>
                    </td>

                    <td className="p-3">
                      {fw.is_latest ? (
                        <span className="text-green-400 font-semibold">
                          Latest
                        </span>
                      ) : (
                        <button
                          onClick={() => setAsLatest(fw.id)}
                          className="px-3 py-1 rounded bg-yellow-600 hover:bg-yellow-700"
                        >
                          Set as Latest
                        </button>
                      )}
                    </td>

                    <td className="p-3">
                      {fw.created_at
                        ? new Date(fw.created_at).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}