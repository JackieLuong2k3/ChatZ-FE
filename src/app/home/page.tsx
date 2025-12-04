import Header from "@/components/Header";

const HomePage = () => {
  return( <div>
    <Header />
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
    <div className="text-center">
      <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
        Start Chatting
      </h1>
    </div>
    </main>
    </div>);
};

export default HomePage;