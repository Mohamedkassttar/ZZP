// Test file to verify JSX syntax
export function TestModal() {
  const showEditor = true;

  return (
    <div>
      {showEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-60">
          <div className="bg-white">
            <div>Header</div>
            <div>Content</div>
            <div>Footer</div>
          </div>
        </div>
      )}
    </div>
  );
}
