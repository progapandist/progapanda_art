class UserRepository
  include Singleton

  MAX_USERS = 1000

  def initialize
    @users = {}
  end

  def create(id)
    evict_oldest if @users.size >= MAX_USERS
    user = User.new(id, [])
    @users[id] = user
    user
  end

  def find(id)
    @users[id]
  end

  private

  def evict_oldest
    oldest_key = @users.keys.first
    @users.delete(oldest_key)
  end
end
